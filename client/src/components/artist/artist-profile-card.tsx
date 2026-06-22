import { useState, useRef, useEffect, useCallback } from "react";
import { logger } from "@/lib/logger";
import { FanCaptureModal } from "./FanCaptureModal";
import { motion, useScroll, useTransform, useSpring, useReducedMotion } from "framer-motion";
import { Button } from "../ui/button";
import { EditProfileDialog } from "./edit-profile-dialog";
import { ImageGalleryDisplay } from "./image-gallery-display";
import { SectionCard, SectionEmptyState } from "./section-card";
import {
  CustomBlockRenderer,
  CustomBlockEditor,
  CustomBlocksAdder,
  isCustomBlockId,
  newCustomBlockId,
  blockLabel,
  blockIcon,
  type CustomBlock,
} from "./custom-blocks";
import { formatLocation } from "../../lib/formatLocation";
import { ArtistDownloads } from "./artist-downloads";
// Heavy Artist Profile modules are code-split via React.lazy in ./lazy-modules.
// They keep the same names + props API but download their JS chunk on demand,
// only when their section becomes visible. See ./lazy-modules for details.
import {
  InfluencerModule, TalkToMeModule, AmazonCuratedPicksModule, FashionVirtualStore,
  ArtistCareerSuite, EpkSection, ArtistNewsGenerator, AvatarTalkModule, EarningsChart,
  MyUniverseModule, SponsorPanel, VenueBookingPanel, ExplicitContentSection, AASEnginePanel,
  AudienceCaptureDashboard, ViralProductGenerator, BrandCollabPanel, ArtistBusinessPlan,
  ArtistBusinessPlanV2, TokenizationPanel, EconomicEngineDashboard, CryptoCommunityDashboard,
  TokenizedMusicView, VinylPreorderModule, VinylEditionModule, VinylRecordsHub, ArtGalleryModule,
  SmartMerchModule, OfficialStoreSection, FanClubPanel, ArtistBlueprintPanel, ArtistDomainManager,
  HermesAgentPanel, AgentGatewayPanel, AgentConsole, HologramProjectPanel, RenaissanceStudioSection,
  ObservationEnginePanel, DeepBriefPanel, EmotionalStudioPanel, ArtistPromoClipsModule, AIVideoStudio,
  AdsCampaignManager, GammaPresentationsModule, KaraokeModule, KaraokePlayer, LyricsVideoModule,
  ConcertCommandCenter, BoostifyLiveStage, WhatsAppCommandCenter, TelegramCommandCenter,
  RedditIntelligenceCenter, DiscordFanNation, FacebookGroupsCommandCenter,
} from "./lazy-modules";
import { useAuth } from "../../hooks/use-auth";
import { useTierLimits } from "../../hooks/use-tier-limits";
import { PremiumGate, UploadLimitBanner, ModuleGuide } from "../ui/premium-gate";
import { useTranslation } from "react-i18next";
import {
  Play,
  Pause,
  Music2,
  Video as VideoIcon,
  Share2,
  ShoppingBag,
  ShoppingCart,
  Shirt,
  MapPin,
  ExternalLink,
  Calendar,
  Ticket,
  Users,
  Music,
  Check,
  Trash2,
  Upload,
  Plus,
  X,
  Pencil,
  GripVertical,
  Layout,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Instagram,
  Scale,
  Headphones,
  GraduationCap,
  Briefcase,
  Eye,
  EyeOff,
  Megaphone,
  Crown,
  Zap,
  Film,
  Camera,
  Bot,
  AlertCircle,
  Save,
  Bookmark,
  FolderOpen,
  Image,
  TrendingUp,
  DollarSign,
  Target,
  Globe,
  Twitter,
  Youtube,
  Facebook,
  Tag,
  Settings,
  Download,
  RefreshCw,
  Newspaper,
  Coins,
  FileText,
  Copy,
  Clock,
  Info,
  Handshake,
  ArrowUp,
  ArrowDown,
  Lock,
  Flame,
  Store,
  Smartphone,
  Rocket,
  QrCode,
  BarChart3,
  CreditCard,
  Wallet,
  Gem,
  Star,
  Maximize2,
  Minimize2,
  LogIn,
  LogOut,
  Trophy,
  Shield,
  Cpu,
  Mic2,
  Workflow,
  Disc3,
} from "lucide-react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCachedQuery, CACHE_TTL } from "../../hooks/use-cached-query";
import { collection, getDocs, query, where, doc, setDoc, deleteDoc, getDoc, updateDoc } from "firebase/firestore";
import { db, storage } from "../../firebase";
import { ref, uploadBytesResumable, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { useToast } from "../../hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import QRCode from "react-qr-code";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, RadialBarChart, RadialBar } from "recharts";
import { CrowdfundingButton } from "../crowdfunding/crowdfunding-button";
import { CrowdfundingPanel } from "../crowdfunding/crowdfunding-panel";
import { HowBoostifyWorks } from "../modals/how-boostify-works";
import { Layers, Wand2, Antenna, Radar, Radio, Network, Brain, Activity, Package, Clapperboard, Images, Send, MessageCircle, Heart, Monitor, ScrollText, BookOpen, Palette } from "lucide-react";
import { MerchCollaborationContract } from "../merch/merch-collaboration-contract";
import { SocialPostsDisplay } from "./social-posts-display";
import { PromoteSongModal } from "../admin/promote-song-modal";
import { VideoPlayerWithNotes } from "../video/video-player-with-notes";
import { NewsArticleModal } from "./news-article-modal";
import { PromoteModal } from "./promote-modal";
import { queryClient, apiRequest } from "../../lib/queryClient";
import { HitScoreBar, calculateHitScore } from "../ui/hit-score-bar";
import { getPageModeConfig, getSectionLabel, getWidgetLabel, getDefaultVisibility, type PageMode } from "../../config/page-modes";
import { useAudioPlayer, type AudioTrack, getAutoplayPreference } from "../../contexts/audio-player-context";
import { SongCoverGenerateDialog } from "./SongCoverGenerateDialog";
import { ProfileSectionErrorBoundary } from "./profile-section-error-boundary";
import { ListeningExperience } from "./ListeningExperience";
import LanguageSwitcher from "./LanguageSwitcher";
import useModuleAccess from "../../hooks/use-module-access";
import { getModule } from "../../../../shared/module-catalog";
// TicketCheckoutModal = the SEPARATE, standalone ticketing/shows module that
// powers the public "Upcoming Shows" buy flow (entradas only, no merch upsell).
import { TicketCheckoutModal, type ShowEvent } from './TicketCheckoutModal';

export interface ArtistProfileProps {
  artistId: string;
  initialArtistData?: any; // Datos iniciales del artista (opcional)
}

interface Song {
  id: string;
  name: string;
  title?: string;
  plays?: number;
  duration?: string;
  audioUrl: string;
  userId: string;
  createdAt?: any;
  storageRef?: string;
  coverArt?: string;
  genre?: string;
  description?: string;
  isrc?: string;
  upc?: string;
  composers?: string[];
  lyrics?: string;
  isSingle?: boolean;
  singlePinnedAt?: any;
  displayOrder?: number;
}

const toDateValue = (value: any): Date | undefined => {
  if (!value) return undefined;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

// Song Metadata Modal Component for Distribution
function SongMetadataModal({ 
  song, 
  artistName,
  artistImages,
  colors, 
  isOpen, 
  onClose,
  onSongUpdate
}: { 
  song: Song; 
  artistName: string;
  artistImages?: string[];
  colors: any; 
  isOpen: boolean; 
  onClose: () => void;
  onSongUpdate?: (updatedSong: Song) => void;
}) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  // Editable metadata state
  const [editableData, setEditableData] = useState({
    isrc: song.isrc || '',
    upc: song.upc || '',
    composers: song.composers?.join(', ') || artistName,
    genre: song.genre || '',
    lyrics: song.lyrics || '',
  });
  
  // Cover art generation state
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [generatedCoverArt, setGeneratedCoverArt] = useState<string | null>(song.coverArt || null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const coverArtInputRef = useRef<HTMLInputElement>(null);

  // Sync internal state when a different song is selected
  useEffect(() => {
    if (isOpen && song?.id) {
      setEditableData({
        isrc: song.isrc || '',
        upc: song.upc || '',
        composers: song.composers?.join(', ') || artistName,
        genre: song.genre || '',
        lyrics: song.lyrics || '',
      });
      setGeneratedCoverArt(song.coverArt || null);
      setHasChanges(false);
      setIsSaving(false);
      setIsGeneratingCover(false);
    }
  }, [song?.id, isOpen]);

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    if (date.toDate) return date.toDate().toLocaleDateString();
    if (date instanceof Date) return date.toLocaleDateString();
    return new Date(date).toLocaleDateString();
  };

  // Generate cover art using FAL AI + OpenAI DALL-E fallback
  const handleGenerateCoverArt = async () => {
    setIsGeneratingCover(true);
    try {
      const songTitle = song.title || song.name;
      const genre = editableData.genre || song.genre || 'music';

      // Server enriches with title, artist name, genre and profile-image
      // reference (gpt-image-1/edit/byok cascade). We just steer the vibe.
      const prompt = `Editorial album cover for "${songTitle}" (${genre}) by ${artistName}. Cinematic studio lighting, premium high-end vinyl LP cover composition, magazine-cover retouching, bold visual identity, square 1:1.`;

      const result = await apiRequest('/api/songs/generate-cover-art', {
        method: 'POST',
        data: {
          prompt,
          songId: song.id,
          songTitle,
          artistName,
          genre,
          mood: song.genre ? null : null,
          description: song.description || null,
          referenceImage: artistImages?.[0] || null,
        },
      });

      if (result.success && result.coverArtUrl) {
        setGeneratedCoverArt(result.coverArtUrl);
        setHasChanges(true);
        toast({
          title: 'Cover Art Generated!',
          description: `Your album cover has been created with AI (${result.provider || 'AI'}).`,
        });
      } else {
        throw new Error(result.message || 'No cover art returned');
      }
    } catch (error: any) {
      console.error('Error generating cover art:', error);
      toast({
        title: 'Generation Failed',
        description: error.message || 'Could not generate cover art. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingCover(false);
    }
  };

  // Upload a local image file as cover art
  const handleUploadCoverArt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingCover(true);
    try {
      const storageRef = ref(storage, `songs/${song.id}/cover-art-${Date.now()}.${file.name.split('.').pop() || 'jpg'}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(snapshot.ref);
      setGeneratedCoverArt(downloadUrl);
      setHasChanges(true);
      toast({ title: 'Image uploaded!', description: 'Click "Save Changes" to persist it.' });
    } catch (error: any) {
      console.error('Error uploading cover art:', error);
      toast({ title: 'Upload Failed', description: error.message || 'Could not upload image.', variant: 'destructive' });
    } finally {
      setIsUploadingCover(false);
      if (coverArtInputRef.current) coverArtInputRef.current.value = '';
    }
  };

  // Save metadata to database
  const handleSaveMetadata = async () => {
    setIsSaving(true);
    try {
      const result = await apiRequest(`/api/songs/${song.id}/metadata`, {
        method: 'PUT',
        data: {
          isrc: editableData.isrc || null,
          upc: editableData.upc || null,
          composers: editableData.composers.split(',').map(c => c.trim()).filter(Boolean),
          genre: editableData.genre || null,
          lyrics: editableData.lyrics || null,
          coverArt: generatedCoverArt || song.coverArt,
        },
      });
      
      toast({
        title: 'Metadata Saved!',
        description: 'Song information has been updated.',
      });
      
      setHasChanges(false);
      
      // Notify parent of update
      if (onSongUpdate && result.song) {
        onSongUpdate(result.song);
      }
    } catch (error: any) {
      console.error('Error saving metadata:', error);
      toast({
        title: 'Save Failed',
        description: error.message || 'Could not save metadata. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    setEditableData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: `${label} copied to clipboard`,
    });
  };

  const copyAllMetadata = () => {
    const allData = [
      `Track Title: ${song.title || song.name}`,
      `Artist Name: ${artistName}`,
      `Duration: ${song.duration || '3:45'}`,
      `Genre: ${editableData.genre || 'Not specified'}`,
      `ISRC Code: ${editableData.isrc || 'Not assigned'}`,
      `UPC Code: ${editableData.upc || 'Not assigned'}`,
      `Composers: ${editableData.composers}`,
      `Release Date: ${formatDate(song.createdAt)}`,
    ].join('\n');
    
    navigator.clipboard.writeText(allData);
    toast({
      title: 'All Metadata Copied!',
      description: 'Song metadata copied to clipboard',
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-full md:max-w-lg bg-gray-950 border max-h-[90vh] overflow-y-auto mx-auto px-4 sm:px-6 md:px-8" style={{ borderColor: colors.hexBorder }}>
        <DialogHeader className="pt-4 sm:pt-6">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl" style={{ color: colors.hexAccent }}>
            <FileText className="h-5 w-5 flex-shrink-0" />
            <span className="break-words text-xs sm:text-sm md:text-base">Song Metadata for Distribution</span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Generate stunning artwork with AI, or upload your own.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4">
          {/* Cover Art Section */}
          <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-black/50 border" style={{ borderColor: colors.hexBorder }}>
            {/* Hidden file input for custom cover upload */}
            <input
              ref={coverArtInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUploadCoverArt}
            />
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
              <span className="text-xs sm:text-sm font-medium text-white flex items-center gap-2 flex-shrink-0">
                <Image className="h-4 w-4 flex-shrink-0" style={{ color: colors.hexAccent }} />
                Cover Art
              </span>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => coverArtInputRef.current?.click()}
                  disabled={isUploadingCover || isGeneratingCover}
                  className="flex-1 sm:flex-none text-xs sm:text-sm border-gray-600 text-gray-300 hover:bg-gray-800"
                >
                  {isUploadingCover ? (
                    <><RefreshCw className="h-3 w-3 mr-1 animate-spin flex-shrink-0" />Subiendo...</>
                  ) : (
                    <><Upload className="h-3 w-3 mr-1 flex-shrink-0" />Subir imagen</>
                  )}
                </Button>
                <Button
                  size="sm"
                  onClick={handleGenerateCoverArt}
                  disabled={isGeneratingCover || isUploadingCover}
                  style={{ background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`, color: 'white' }}
                  className="flex-1 sm:flex-none text-xs sm:text-sm"
                >
                  {isGeneratingCover ? (
                    <><RefreshCw className="h-3 w-3 mr-1 animate-spin flex-shrink-0" />Generando...</>
                  ) : (
                    <><Sparkles className="h-3 w-3 mr-1 flex-shrink-0" />Generar con IA</>
                  )}
                </Button>
              </div>
            </div>
            
            <div className="flex justify-center">
              {generatedCoverArt ? (
                <div className="relative group">
                  <img 
                    src={generatedCoverArt} 
                    alt={song.title || song.name}
                    className="w-24 h-24 sm:w-32 sm:h-32 rounded-lg object-cover shadow-lg"
                    style={{ boxShadow: `0 4px 12px ${colors.hexPrimary}40` }}
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col items-center justify-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => coverArtInputRef.current?.click()}
                      disabled={isUploadingCover || isGeneratingCover}
                      className="text-white text-xs"
                    >
                      <Upload className="h-3 w-3 mr-1 flex-shrink-0" />
                      Cambiar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleGenerateCoverArt}
                      disabled={isGeneratingCover || isUploadingCover}
                      className="text-white text-xs"
                    >
                      <RefreshCw className="h-3 w-3 mr-1 flex-shrink-0" />
                      IA
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <div
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg flex flex-col items-center justify-center gap-2 border-2 border-dashed cursor-pointer hover:bg-gray-800/50 transition-colors"
                    style={{ borderColor: colors.hexBorder }}
                    onClick={() => coverArtInputRef.current?.click()}
                  >
                    <Upload className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" style={{ color: colors.hexAccent }} />
                    <span className="text-xs text-gray-400 text-center">Subir<br/>imagen</span>
                  </div>
                  <div
                    className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg flex flex-col items-center justify-center gap-2 border-2 border-dashed cursor-pointer hover:bg-gray-800/50 transition-colors"
                    style={{ borderColor: colors.hexBorder }}
                    onClick={handleGenerateCoverArt}
                  >
                    <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" style={{ color: colors.hexAccent }} />
                    <span className="text-xs text-gray-400 text-center">Generar<br/>con IA</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Read-only Fields */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 sm:p-3 rounded-lg bg-black/50 border" style={{ borderColor: colors.hexBorder }}>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-gray-400">Track Title</span>
                <p className="text-xs sm:text-sm text-white font-medium truncate">{song.title || song.name}</p>
              </div>
              <button onClick={() => copyToClipboard(song.title || song.name, 'Track Title')} className="p-1.5 rounded-lg hover:bg-gray-800 flex-shrink-0">
                <Copy className="h-3 w-3 sm:h-4 sm:w-4" style={{ color: colors.hexAccent }} />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 sm:p-3 rounded-lg bg-black/50 border" style={{ borderColor: colors.hexBorder }}>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-gray-400">Artist Name</span>
                <p className="text-xs sm:text-sm text-white font-medium truncate">{artistName}</p>
              </div>
              <button onClick={() => copyToClipboard(artistName, 'Artist Name')} className="p-1.5 rounded-lg hover:bg-gray-800 flex-shrink-0">
                <Copy className="h-3 w-3 sm:h-4 sm:w-4" style={{ color: colors.hexAccent }} />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 sm:p-3 rounded-lg bg-black/50 border" style={{ borderColor: colors.hexBorder }}>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-gray-400">Duration</span>
                <p className="text-xs sm:text-sm text-white font-medium">{song.duration || '3:45'}</p>
              </div>
              <button onClick={() => copyToClipboard(song.duration || '3:45', 'Duration')} className="p-1.5 rounded-lg hover:bg-gray-800 flex-shrink-0">
                <Copy className="h-3 w-3 sm:h-4 sm:w-4" style={{ color: colors.hexAccent }} />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 sm:p-3 rounded-lg bg-black/50 border" style={{ borderColor: colors.hexBorder }}>
              <div className="flex-1 min-w-0">
                <span className="text-xs text-gray-400">Release Date</span>
                <p className="text-xs sm:text-sm text-white font-medium">{formatDate(song.createdAt)}</p>
              </div>
              <button onClick={() => copyToClipboard(formatDate(song.createdAt), 'Release Date')} className="p-1.5 rounded-lg hover:bg-gray-800 flex-shrink-0">
                <Copy className="h-3 w-3 sm:h-4 sm:w-4" style={{ color: colors.hexAccent }} />
              </button>
            </div>
          </div>

          {/* Editable Fields */}
          <div className="space-y-2 sm:space-y-3 pt-2 sm:pt-3 border-t" style={{ borderColor: colors.hexBorder }}>
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Settings className="h-3 w-3 flex-shrink-0" />
              Editable Fields (will be saved to database)
            </p>

            <div className="space-y-2">
              <Label className="text-xs text-gray-400">Genre</Label>
              <Input
                value={editableData.genre}
                onChange={(e) => handleFieldChange('genre', e.target.value)}
                placeholder="e.g., Pop, Rock, Hip-Hop"
                className="bg-black/50 border text-white text-xs sm:text-sm h-8 sm:h-10"
                style={{ borderColor: colors.hexBorder }}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-gray-400">ISRC Code</Label>
              <Input
                value={editableData.isrc}
                onChange={(e) => handleFieldChange('isrc', e.target.value)}
                placeholder="e.g., USRC17607839"
                className="bg-black/50 border text-white text-xs sm:text-sm h-8 sm:h-10"
                style={{ borderColor: colors.hexBorder }}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-gray-400">UPC Code</Label>
              <Input
                value={editableData.upc}
                onChange={(e) => handleFieldChange('upc', e.target.value)}
                placeholder="e.g., 012345678905"
                className="bg-black/50 border text-white text-xs sm:text-sm h-8 sm:h-10"
                style={{ borderColor: colors.hexBorder }}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-gray-400">Composers (comma separated)</Label>
              <Input
                value={editableData.composers}
                onChange={(e) => handleFieldChange('composers', e.target.value)}
                placeholder="e.g., John Doe, Jane Smith"
                className="bg-black/50 border text-white text-xs sm:text-sm h-8 sm:h-10"
                style={{ borderColor: colors.hexBorder }}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-gray-400">Lyrics (optional)</Label>
              <textarea
                value={editableData.lyrics}
                onChange={(e) => handleFieldChange('lyrics', e.target.value)}
                placeholder="Enter song lyrics..."
                rows={2}
                className="w-full bg-black/50 border text-white rounded-md p-2 text-xs sm:text-sm resize-none"
                style={{ borderColor: colors.hexBorder }}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 sm:gap-2 pt-3 sm:pt-4 pb-2 border-t" style={{ borderColor: colors.hexBorder }}>
          {/* Save Changes */}
          {hasChanges && (
            <Button
              onClick={handleSaveMetadata}
              disabled={isSaving}
              className="w-full text-white text-xs sm:text-sm h-9 sm:h-11 px-3 sm:px-4"
              style={{ background: '#22C55E' }}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 animate-spin flex-shrink-0" />
                  <span className="hidden sm:inline">Saving...</span>
                  <span className="sm:hidden">Save...</span>
                </>
              ) : (
                <>
                  <Save className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 flex-shrink-0" />
                  <span className="hidden sm:inline">Save Changes</span>
                  <span className="sm:hidden">Save</span>
                </>
              )}
            </Button>
          )}

          {/* Copy All Button */}
          <Button
            variant="outline"
            onClick={copyAllMetadata}
            className="w-full text-xs sm:text-sm h-9 sm:h-11 px-3 sm:px-4"
            style={{ borderColor: colors.hexBorder, color: colors.hexAccent }}
          >
            <Copy className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 flex-shrink-0" />
            <span className="hidden sm:inline">Copy All Metadata</span>
            <span className="sm:hidden">Copy All</span>
          </Button>

          {/* Go to Distribution */}
          <Button
            onClick={() => {
              onClose();
              setLocation('/artist-dashboard');
            }}
            className="w-full text-white text-xs sm:text-sm h-9 sm:h-11 px-3 sm:px-4"
            style={{ background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})` }}
          >
            <Globe className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 flex-shrink-0" />
            <span className="hidden sm:inline">Go to Distribution</span>
            <span className="sm:hidden">Distribution</span>
          </Button>

          {/* Register Directly - Coming Soon */}
          <Button
            variant="outline"
            disabled
            className="w-full text-xs sm:text-sm h-9 sm:h-11 px-3 sm:px-4 relative overflow-hidden"
            style={{ borderColor: colors.hexBorder, color: 'gray' }}
          >
            <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 flex-shrink-0" />
            <span className="hidden sm:inline">Register Directly</span>
            <span className="sm:hidden">Register</span>
            <span 
              className="absolute top-0.5 right-0.5 text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: colors.hexPrimary, color: 'white' }}
            >
              Soon
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface Video {
  id: string;
  title: string;
  thumbnailUrl?: string;
  url: string;
  userId: string;
  createdAt?: any;
  views?: number;
  likes?: number;
  type?: 'youtube' | 'uploaded';
  storagePath?: string;
  downloadPassword?: string;
  fileFormat?: string;
  fileSize?: number;
  scriptPdfUrl?: string;
  scriptPdfPath?: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  userId: string;
  sizes?: string[];
  createdAt?: any;
}

interface Show {
  id: string;
  venue: string;
  date: string;
  location: string;
  ticketUrl?: string;
}

// Paletas de colores � 20 estilos organizados por categor�a
type PaletteCategory = 'dark' | 'vibrant' | 'elegant' | 'neon' | 'nature';

const FONT_OPTIONS = [
  { key: 'default',    label: 'System Default',   heading: 'Inter',              body: 'Inter',              gfUrl: '',                                    style: 'default'   },
  { key: 'montserrat', label: 'Montserrat',        heading: 'Montserrat',         body: 'Montserrat',         gfUrl: 'Montserrat:wght@400;700;900',         style: 'modern'    },
  { key: 'bebas',      label: 'Bebas Neue',        heading: 'Bebas Neue',         body: 'Inter',              gfUrl: 'Bebas+Neue',                          style: 'bold'      },
  { key: 'playfair',   label: 'Playfair Display',  heading: 'Playfair Display',   body: 'Lato',               gfUrl: 'Playfair+Display:wght@700;900|Lato:wght@400;700', style: 'elegant' },
  { key: 'space',      label: 'Space Grotesk',     heading: 'Space Grotesk',      body: 'Space Grotesk',      gfUrl: 'Space+Grotesk:wght@400;700',          style: 'tech'      },
  { key: 'raleway',    label: 'Raleway',           heading: 'Raleway',            body: 'Raleway',            gfUrl: 'Raleway:wght@400;600;800',            style: 'elegant'   },
  { key: 'outfit',     label: 'Outfit',            heading: 'Outfit',             body: 'Outfit',             gfUrl: 'Outfit:wght@400;700;900',             style: 'modern'    },
  { key: 'syne',       label: 'Syne',              heading: 'Syne',               body: 'Syne',               gfUrl: 'Syne:wght@400;700;800',               style: 'futuristic'},
  { key: 'dm-serif',   label: 'DM Serif Display',  heading: 'DM Serif Display',   body: 'DM Sans',            gfUrl: 'DM+Serif+Display|DM+Sans:wght@400;500', style: 'editorial'},
  { key: 'exo2',       label: 'Exo 2',             heading: 'Exo 2',              body: 'Exo 2',              gfUrl: 'Exo+2:wght@400;700;900',              style: 'tech'      },
  { key: 'cormorant',  label: 'Cormorant',         heading: 'Cormorant Garamond', body: 'Proza Libre',        gfUrl: 'Cormorant+Garamond:wght@400;600;700|Proza+Libre', style: 'luxury' },
  { key: 'josefin',    label: 'Josefin Sans',      heading: 'Josefin Sans',       body: 'Josefin Sans',       gfUrl: 'Josefin+Sans:wght@300;400;700',       style: 'minimal'   },
] as const;
type FontOptionKey = typeof FONT_OPTIONS[number]['key'];

interface ColorPalette {
  hexAccent: string;
  hexPrimary: string;
  hexBorder: string;
  textMuted: string;
  bgGradient: string;
  shadow: string;
  category: PaletteCategory;
  cardBg: string;       // card background CSS
  cardBorder: string;    // border style: 'solid' | 'glow' | 'gradient'
  preview: string[];     // 3 preview colors for selector
}

interface ArtistProfileLayoutSnapshot {
  order: string[];
  visibility: Record<string, boolean>;
  expanded: Record<string, boolean>;
  rightOrder: string[];
  rightExpanded: Record<string, boolean>;
  rightVisibility: Record<string, boolean>;
  colorTheme: string;
  fontKey: string;
  customBlocks: Record<string, CustomBlock>;
  mobileColumnFirst: 'left' | 'right';
  sideOverride: Record<string, 'left' | 'right'>;
}

interface ArtistProfileLayoutPreset {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  layout: ArtistProfileLayoutSnapshot;
}

const MAX_LAYOUT_PRESETS = 12;

// Curated, ready-made layout presets. Each one opens a focused set of modules
// based on what the artist wants to highlight (music, sales, fans, etc.).
interface PredeterminedLayoutPreset {
  key: string;
  label: string;
  description: string;
  icon: any;
  accent: string;
  sections: string[];
  widgets: string[];
  allOn?: boolean;
}

const PREDETERMINED_LAYOUT_PRESETS: PredeterminedLayoutPreset[] = [
  {
    key: 'music',
    label: 'Music',
    description: 'Catalog, videos and lyrics up front.',
    icon: Music,
    accent: '#8b5cf6',
    sections: ['songs', 'videos', 'lyrics-video', 'karaoke', 'galleries', 'social-hub'],
    widgets: ['spotify', 'information', 'qr-card', 'social-media'],
  },
  {
    key: 'store',
    label: 'Store & Sales',
    description: 'Merch, fashion, vinyl and monetization.',
    icon: ShoppingCart,
    accent: '#10b981',
    sections: ['merchandise', 'fashion-store', 'vinyl-records', 'amazon-picks', 'viral-products', 'monetize-cta'],
    widgets: ['qr-card', 'information', 'physical-cards', 'upcoming-shows'],
  },
  {
    key: 'fans',
    label: 'Fans & Community',
    description: 'Fan club, socials and exclusive content.',
    icon: Users,
    accent: '#ec4899',
    sections: ['fanclub', 'social-hub', 'social-posts', 'news', 'explicit-content'],
    widgets: ['crypto-community', 'social-media', 'qr-card', 'information'],
  },
  {
    key: 'investors',
    label: 'Investors & Tokens',
    description: 'Tokenization, crowdfunding and metrics.',
    icon: Coins,
    accent: '#f59e0b',
    sections: ['tokenization', 'crowdfunding', 'business-plan', 'analytics', 'earnings'],
    widgets: ['economic-engine', 'tokenized-music', 'statistics', 'qr-card'],
  },
  {
    key: 'live',
    label: 'Live Shows',
    description: 'Concerts, booking and holography.',
    icon: Mic2,
    accent: '#06b6d4',
    sections: ['songs', 'videos', 'venueBooking', 'hologram', 'promo-clips'],
    widgets: ['upcoming-shows', 'concert-hub', 'qr-card', 'information'],
  },
  {
    key: 'press',
    label: 'Press / EPK',
    description: 'Press kit, career, news and gallery.',
    icon: BookOpen,
    accent: '#f97316',
    sections: ['electronic-press-kit', 'career-suite', 'news', 'videos', 'galleries'],
    widgets: ['information', 'qr-card', 'social-media', 'spotify'],
  },
  {
    key: 'studio',
    label: 'AI Studio',
    description: 'Generative studios and creative tools.',
    icon: Wand2,
    accent: '#a855f7',
    sections: ['renaissance-studio', 'ai-video-studio', 'promo-clips', 'emotional-studio', 'gamma-presentations', 'lyrics-video'],
    widgets: ['premium-tools', 'information', 'qr-card', 'statistics'],
  },
  {
    key: 'marketing',
    label: 'Marketing & Growth',
    description: 'Ads, influencers and audience growth.',
    icon: Megaphone,
    accent: '#f43f5e',
    sections: ['ads-campaigns', 'influencer-module', 'social-posts', 'social-hub', 'audience-engine'],
    widgets: ['statistics', 'social-media', 'information', 'qr-card'],
  },
  {
    key: 'video',
    label: 'Video & Visuals',
    description: 'Video catalog, clips and visual content.',
    icon: Film,
    accent: '#6366f1',
    sections: ['videos', 'promo-clips', 'ai-video-studio', 'lyrics-video', 'galleries'],
    widgets: ['spotify', 'information', 'qr-card', 'social-media'],
  },
  {
    key: 'interactive',
    label: 'Interactive',
    description: 'Avatar, chat, karaoke and holostage.',
    icon: Bot,
    accent: '#14b8a6',
    sections: ['avatar-talk', 'talk-to-me', 'karaoke', 'hologram', 'fanclub'],
    widgets: ['social-media', 'crypto-community', 'qr-card', 'information'],
  },
  {
    key: 'business',
    label: 'Brand & Business',
    description: 'Collabs, blueprint and career suite.',
    icon: Briefcase,
    accent: '#ea580c',
    sections: ['brand-collabs', 'business-plan', 'career-suite', 'artist-blueprint', 'agent-gateway', 'electronic-press-kit'],
    widgets: ['economic-engine', 'statistics', 'information', 'qr-card'],
  },
  {
    key: 'web3',
    label: 'Web3 & Crypto',
    description: 'Tokens, vinyl editions and treasury.',
    icon: Wallet,
    accent: '#eab308',
    sections: ['tokenization', 'vinyl-editions', 'viral-products', 'monetize-cta'],
    widgets: ['economic-engine', 'tokenized-music', 'crypto-community', 'qr-card'],
  },
  {
    key: 'showcase',
    label: 'Full Showcase',
    description: 'Turn on every available module.',
    icon: Sparkles,
    accent: '#facc15',
    sections: [],
    widgets: [],
    allOn: true,
  },
  {
    key: 'essential',
    label: 'Essential',
    description: 'Clean profile: music, video and gallery.',
    icon: Layout,
    accent: '#64748b',
    sections: ['songs', 'videos', 'galleries'],
    widgets: ['qr-card', 'information', 'spotify'],
  },
];

const colorPalettes: Record<string, ColorPalette> = {
  // ═══ DARK ═══
  'Boostify Naranja': {
    hexAccent: '#F97316', hexPrimary: '#FF8800', hexBorder: '#5E2B0C',
    textMuted: 'gray-400',
    bgGradient: "bg-gradient-to-br from-black via-gray-950 to-orange-950",
    shadow: 'shadow-orange-900/10',
    category: 'dark',
    cardBg: 'linear-gradient(180deg, #111827 0%, #030712 100%)',
    cardBorder: 'solid',
    preview: ['#FF8800', '#F97316', '#5E2B0C'],
  },
  'Midnight Carbon': {
    hexAccent: '#94A3B8', hexPrimary: '#64748B', hexBorder: '#334155',
    textMuted: 'slate-400',
    bgGradient: "bg-gradient-to-br from-black via-slate-950 to-slate-900",
    shadow: 'shadow-slate-900/20',
    category: 'dark',
    cardBg: 'linear-gradient(135deg, #0F172A 0%, #020617 100%)',
    cardBorder: 'solid',
    preview: ['#64748B', '#94A3B8', '#334155'],
  },
  'Obsidian Night': {
    hexAccent: '#A78BFA', hexPrimary: '#7C3AED', hexBorder: '#4C1D95',
    textMuted: 'purple-300',
    bgGradient: "bg-gradient-to-br from-black via-gray-950 to-purple-950",
    shadow: 'shadow-purple-900/15',
    category: 'dark',
    cardBg: 'linear-gradient(145deg, #1A0A2E 0%, #0A0015 100%)',
    cardBorder: 'glow',
    preview: ['#7C3AED', '#A78BFA', '#4C1D95'],
  },
  'Deep Space': {
    hexAccent: '#22D3EE', hexPrimary: '#0891B2', hexBorder: '#164E63',
    textMuted: 'cyan-300',
    bgGradient: "bg-gradient-to-br from-black via-gray-950 to-cyan-950",
    shadow: 'shadow-cyan-900/15',
    category: 'dark',
    cardBg: 'linear-gradient(160deg, #0C1929 0%, #020D1B 100%)',
    cardBorder: 'solid',
    preview: ['#0891B2', '#22D3EE', '#164E63'],
  },
  // ═══ VIBRANT ═══
  'Sunset Blaze': {
    hexAccent: '#FB923C', hexPrimary: '#EF4444', hexBorder: '#7F1D1D',
    textMuted: 'orange-200',
    bgGradient: "bg-gradient-to-br from-black via-red-950 to-orange-950",
    shadow: 'shadow-red-900/20',
    category: 'vibrant',
    cardBg: 'linear-gradient(135deg, #1C0A0A 0%, #0C0404 50%, #1A0E05 100%)',
    cardBorder: 'gradient',
    preview: ['#EF4444', '#FB923C', '#FBBF24'],
  },
  'Electric Blue': {
    hexAccent: '#38BDF8', hexPrimary: '#2563EB', hexBorder: '#1E40AF',
    textMuted: 'sky-300',
    bgGradient: "bg-gradient-to-br from-black via-blue-950 to-sky-950",
    shadow: 'shadow-blue-900/15',
    category: 'vibrant',
    cardBg: 'linear-gradient(135deg, #0A1628 0%, #020818 100%)',
    cardBorder: 'glow',
    preview: ['#2563EB', '#38BDF8', '#60A5FA'],
  },
  'Cherry Blossom': {
    hexAccent: '#FB7185', hexPrimary: '#E11D48', hexBorder: '#881337',
    textMuted: 'rose-200',
    bgGradient: "bg-gradient-to-br from-black via-rose-950 to-pink-950",
    shadow: 'shadow-rose-900/15',
    category: 'vibrant',
    cardBg: 'linear-gradient(145deg, #1A0A12 0%, #0D0408 100%)',
    cardBorder: 'gradient',
    preview: ['#E11D48', '#FB7185', '#FDA4AF'],
  },
  'Tropical Fusion': {
    hexAccent: '#34D399', hexPrimary: '#F97316', hexBorder: '#065F46',
    textMuted: 'emerald-200',
    bgGradient: "bg-gradient-to-br from-black via-emerald-950 to-orange-950",
    shadow: 'shadow-emerald-900/15',
    category: 'vibrant',
    cardBg: 'linear-gradient(135deg, #041F14 0%, #0A0400 50%, #061210 100%)',
    cardBorder: 'gradient',
    preview: ['#F97316', '#34D399', '#065F46'],
  },
  // ═══ ELEGANT ═══
  'Golden Luxe': {
    hexAccent: '#FBBF24', hexPrimary: '#D4A017', hexBorder: '#92600A',
    textMuted: 'amber-200',
    bgGradient: "bg-gradient-to-br from-black via-yellow-950 to-amber-950",
    shadow: 'shadow-yellow-900/15',
    category: 'elegant',
    cardBg: 'linear-gradient(145deg, #1A1508 0%, #0D0B03 100%)',
    cardBorder: 'gradient',
    preview: ['#D4A017', '#FBBF24', '#FDE68A'],
  },
  'Rose Gold': {
    hexAccent: '#F9A8D4', hexPrimary: '#DB2777', hexBorder: '#831843',
    textMuted: 'pink-200',
    bgGradient: "bg-gradient-to-br from-black via-pink-950 to-rose-950",
    shadow: 'shadow-pink-900/15',
    category: 'elegant',
    cardBg: 'linear-gradient(160deg, #1A0A14 0%, #0D0408 100%)',
    cardBorder: 'glow',
    preview: ['#DB2777', '#F9A8D4', '#FBCFE8'],
  },
  'Silver Frost': {
    hexAccent: '#CBD5E1', hexPrimary: '#94A3B8', hexBorder: '#475569',
    textMuted: 'slate-300',
    bgGradient: "bg-gradient-to-br from-black via-slate-900 to-gray-900",
    shadow: 'shadow-slate-800/20',
    category: 'elegant',
    cardBg: 'linear-gradient(145deg, #151B23 0%, #0A0E14 100%)',
    cardBorder: 'solid',
    preview: ['#94A3B8', '#CBD5E1', '#E2E8F0'],
  },
  'Champagne': {
    hexAccent: '#FDE68A', hexPrimary: '#CA8A04', hexBorder: '#713F12',
    textMuted: 'yellow-200',
    bgGradient: "bg-gradient-to-br from-black via-stone-950 to-yellow-950",
    shadow: 'shadow-amber-900/10',
    category: 'elegant',
    cardBg: 'linear-gradient(145deg, #171308 0%, #0C0A04 100%)',
    cardBorder: 'solid',
    preview: ['#CA8A04', '#FDE68A', '#FEF3C7'],
  },
  // ═══ NEON ═══
  'Neon Cyber': {
    hexAccent: '#A3E635', hexPrimary: '#84CC16', hexBorder: '#4D7C0F',
    textMuted: 'lime-300',
    bgGradient: "bg-gradient-to-br from-black via-gray-950 to-green-950",
    shadow: 'shadow-lime-900/10',
    category: 'neon',
    cardBg: 'linear-gradient(135deg, #071209 0%, #020804 100%)',
    cardBorder: 'glow',
    preview: ['#84CC16', '#A3E635', '#D9F99D'],
  },
  'Neon Magenta': {
    hexAccent: '#F472B6', hexPrimary: '#EC4899', hexBorder: '#9D174D',
    textMuted: 'pink-300',
    bgGradient: "bg-gradient-to-br from-black via-gray-950 to-pink-950",
    shadow: 'shadow-pink-900/15',
    category: 'neon',
    cardBg: 'linear-gradient(135deg, #15060E 0%, #0A0307 100%)',
    cardBorder: 'glow',
    preview: ['#EC4899', '#F472B6', '#FBCFE8'],
  },
  'Cyber Purple': {
    hexAccent: '#C084FC', hexPrimary: '#8B5CF6', hexBorder: '#6D28D9',
    textMuted: 'violet-300',
    bgGradient: "bg-gradient-to-br from-black via-gray-950 to-violet-950",
    shadow: 'shadow-violet-900/10',
    category: 'neon',
    cardBg: 'linear-gradient(135deg, #120A1E 0%, #08041A 100%)',
    cardBorder: 'glow',
    preview: ['#8B5CF6', '#C084FC', '#E9D5FF'],
  },
  'Synthwave': {
    hexAccent: '#F0ABFC', hexPrimary: '#D946EF', hexBorder: '#86198F',
    textMuted: 'fuchsia-200',
    bgGradient: "bg-gradient-to-br from-black via-fuchsia-950 to-violet-950",
    shadow: 'shadow-fuchsia-900/15',
    category: 'neon',
    cardBg: 'linear-gradient(135deg, #180A20 0%, #0E0415 50%, #0A0818 100%)',
    cardBorder: 'gradient',
    preview: ['#D946EF', '#F0ABFC', '#E879F9'],
  },
  // ═══ NATURE ═══
  'Forest Mist': {
    hexAccent: '#6EE7B7', hexPrimary: '#059669', hexBorder: '#064E3B',
    textMuted: 'emerald-300',
    bgGradient: "bg-gradient-to-br from-black via-emerald-950 to-green-950",
    shadow: 'shadow-emerald-900/15',
    category: 'nature',
    cardBg: 'linear-gradient(145deg, #061712 0%, #020D09 100%)',
    cardBorder: 'solid',
    preview: ['#059669', '#6EE7B7', '#A7F3D0'],
  },
  'Ocean Deep': {
    hexAccent: '#67E8F9', hexPrimary: '#0891B2', hexBorder: '#155E75',
    textMuted: 'cyan-200',
    bgGradient: "bg-gradient-to-br from-black via-cyan-950 to-teal-950",
    shadow: 'shadow-cyan-900/15',
    category: 'nature',
    cardBg: 'linear-gradient(145deg, #061720 0%, #020A10 100%)',
    cardBorder: 'solid',
    preview: ['#0891B2', '#67E8F9', '#A5F3FC'],
  },
  'Aurora Borealis': {
    hexAccent: '#2DD4BF', hexPrimary: '#0D9488', hexBorder: '#134E4A',
    textMuted: 'teal-200',
    bgGradient: "bg-gradient-to-br from-black via-teal-950 to-emerald-950",
    shadow: 'shadow-teal-900/15',
    category: 'nature',
    cardBg: 'linear-gradient(160deg, #04150F 0%, #020A08 50%, #050E1A 100%)',
    cardBorder: 'glow',
    preview: ['#0D9488', '#2DD4BF', '#5EEAD4'],
  },
  'Desert Sand': {
    hexAccent: '#FCD34D', hexPrimary: '#D97706', hexBorder: '#78350F',
    textMuted: 'amber-200',
    bgGradient: "bg-gradient-to-br from-black via-stone-950 to-amber-950",
    shadow: 'shadow-amber-900/10',
    category: 'nature',
    cardBg: 'linear-gradient(145deg, #1A1408 0%, #0C0A04 100%)',
    cardBorder: 'solid',
    preview: ['#D97706', '#FCD34D', '#FDE68A'],
  },
};

const paletteCategories: { key: PaletteCategory; label: string; icon: string }[] = [
  { key: 'dark', label: 'Dark', icon: '◾' },
  { key: 'vibrant', label: 'Vibrant', icon: '◈' },
  { key: 'elegant', label: 'Elegant', icon: '◇' },
  { key: 'neon', label: 'Neon', icon: '◉' },
  { key: 'nature', label: 'Nature', icon: '◆' },
];

// Componente de Tarjeta de Artista con QR Code
function ArtistCard({ artist, colors, profileUrl }: { artist: any, colors: any, profileUrl: string }) {
  const [showDownload, setShowDownload] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const exportCardRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [imagePosition, setImagePosition] = useState('center 30%');
  const [exportBgDataUrl, setExportBgDataUrl] = useState<string>('');

  const detectWalletPlatform = (): 'ios' | 'android' | 'generic' => {
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) return 'ios';
    if (/android/.test(ua)) return 'android';
    return 'generic';
  };

  // Detectar orientaci�n y ajustar posici�n de imagen
  useEffect(() => {
    const updateImagePosition = () => {
      const isPortrait = window.innerHeight > window.innerWidth;
      const isMobile = window.innerWidth < 768;
      
      if (isMobile && isPortrait) {
        // M�vil vertical: mostrar parte superior (cabezas)
        setImagePosition('center 25%');
      } else if (isMobile && !isPortrait) {
        // M�vil horizontal: centrar m�s
        setImagePosition('center 35%');
      } else {
        // Desktop: posici�n balanceada
        setImagePosition('center 30%');
      }
    };

    updateImagePosition();
    window.addEventListener('resize', updateImagePosition);
    window.addEventListener('orientationchange', updateImagePosition);

    return () => {
      window.removeEventListener('resize', updateImagePosition);
      window.removeEventListener('orientationchange', updateImagePosition);
    };
  }, []);

  /**
   * Convert an image URL to a base64 data URL by drawing it on a canvas.
   * This is necessary because html2canvas does not correctly render
   * CSS object-fit/object-position on <img> elements; using a CSS
   * background-image on a div respects background-size/background-position.
   */
  const fetchImageAsDataUrl = async (src: string): Promise<string> => {
    try {
      const res = await fetch(src, { mode: 'cors' });
      const blob = await res.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      // Fallback: draw via Image + canvas (works for same-origin or CORS-enabled)
      return new Promise((resolve) => {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.97));
        };
        img.onerror = () => resolve(src); // last resort: use original URL
        img.src = src;
      });
    }
  };

  const handleDownloadCard = async () => {
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const element = exportCardRef.current;
      
      if (!element) return;

      // Pre-fetch image as data URL so html2canvas renders the background
      // with the correct position (object-fit/object-position are not reliably
      // supported by html2canvas on <img> elements).
      const imageUrl = artist.profileImage || artist.bannerImage;
      if (imageUrl && !exportBgDataUrl) {
        const dataUrl = await fetchImageAsDataUrl(imageUrl);
        setExportBgDataUrl(dataUrl);
        // Give React one tick to re-render the export card with the data URL
        await new Promise(r => setTimeout(r, 80));
      }
      
      const opt = {
        margin: 0,
        filename: `${artist.name}-artist-card.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 3,
          useCORS: true,
          backgroundColor: '#05070A',
          width: 1011,
          height: 638,
          windowWidth: 1011,
          windowHeight: 638,
          scrollX: 0,
          scrollY: 0,
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
        jsPDF: { unit: 'mm', format: [85.6, 53.98] as any, orientation: 'landscape' as const }
      };
      
      await html2pdf().set(opt).from(element).save();
      
      toast({
        title: "¡Tarjeta descargada!",
        description: "Tu Artist Card ha sido descargada exitosamente",
      });
    } catch (error) {
      logger.error('Error downloading card:', error);
      toast({
        title: "Error",
        description: "No se pudo descargar la tarjeta",
        variant: "destructive"
      });
    }
  };

  const handleAddToWallet = async () => {
    try {
      const platform = detectWalletPlatform();

      const response = await fetch('/api/artist-card/wallet/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          userAgent: navigator.userAgent,
          name: artist.name,
          genre: artist.genre,
          biography: artist.biography,
          website: artist.website,
          instagram: artist.instagram,
          youtube: artist.youtube,
          profileUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Wallet resolver failed');
      }

      if (data.action === 'open_url' && data.url) {
        // Native Apple/Google Wallet pass � open directly in browser so the OS handles it
        if (data.url.includes('/wallet/apple/') || data.url.includes('/wallet/google/')) {
          window.open(data.url, '_blank', 'noopener,noreferrer');
        } else {
          // vCard fallback � fetch and trigger a real file download so the OS
          // opens it with the Contacts/Wallet app instead of showing plain text
          const vcardRes = await fetch(data.url);
          if (!vcardRes.ok) throw new Error('Failed to fetch vCard');
          const vcardText = await vcardRes.text();
          const blob = new Blob([vcardText], { type: 'text/vcard;charset=utf-8' });
          const safeName = (artist.name || 'artist').replace(/[^a-z0-9\-_]+/gi, '-').toLowerCase();
          const fileName = `${safeName}-business-card.vcf`;
          const file = new File([blob], fileName, { type: 'text/vcard' });

          if (navigator.share && navigator.canShare?.({ files: [file] })) {
            await navigator.share({
              title: `${artist.name} - Business Card`,
              text: 'Agrega esta tarjeta a tus contactos/wallet.',
              files: [file],
            });
          } else {
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(blobUrl);
          }
        }
      } else if (data.action === 'download_blob' && data.vcard) {
        const blob = new Blob([String(data.vcard)], { type: data.mimeType || 'text/vcard;charset=utf-8' });
        const fileName = data.fileName || `${(artist.name || 'artist').replace(/[^a-z0-9\-_]+/gi, '-')}-business-card.vcf`;
        const file = new File([blob], fileName, { type: 'text/vcard' });

        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            title: `${artist.name} - Business Card`,
            text: 'Add this artist card to your phone contacts/wallet apps.',
            files: [file],
          });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
        }
      } else {
        throw new Error('Unsupported wallet action');
      }

      toast({
        title: 'Business Card lista para Wallet',
        description: data?.message || 'Se generó tu tarjeta para guardarla en Wallet/Contactos del teléfono.',
      });
    } catch (error) {
      logger.error('Error creating wallet card:', error);
      toast({
        title: 'Error',
        description: 'No se pudo generar la tarjeta para wallet.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Bot�n para obtener la tarjeta */}
      <button
        onClick={() => setShowDownload(!showDownload)}
        className="w-full py-3 md:py-4 px-4 md:px-6 rounded-xl md:rounded-2xl font-bold text-base md:text-lg transition-all duration-300 hover:scale-105 hover:shadow-2xl relative overflow-hidden group"
        style={{
          background: `linear-gradient(135deg, ${colors.hexPrimary} 0%, ${colors.hexAccent} 100%)`,
          color: 'white',
          boxShadow: `0 10px 30px ${colors.hexPrimary}40`
        }}
      >
        <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
        <span className="relative flex items-center justify-center gap-2 md:gap-3">
          <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
          <span className="hidden sm:inline">{showDownload ? 'Ocultar Artist Card' : 'Get Your Artist Card'}</span>
          <span className="sm:hidden">{showDownload ? 'Ocultar' : 'Artist Card'}</span>
        </span>
      </button>

      {/* Tarjeta elegante del artista */}
      {showDownload && (
        <div className="space-y-4">
          <div 
            ref={cardRef}
            className="relative rounded-2xl overflow-hidden shadow-2xl w-full max-w-[420px] mx-auto"
            style={{
              aspectRatio: '1.586',
            }}
          >
            {/* Imagen de fondo con overlay */}
            <div className="absolute inset-0">
              <img
                src={artist.profileImage}
                alt={artist.name}
                className="w-full h-full object-cover"
                style={{ objectPosition: imagePosition }}
                onError={(e) => {
                  const isVideo = artist.bannerImage?.match(/\.(mp4|mov|avi|webm)$/i);
                  if (!isVideo && artist.bannerImage) {
                    e.currentTarget.src = artist.bannerImage;
                  }
                }}
              />
              <div 
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(135deg, 
                    rgba(0,0,0,0.85) 0%, 
                    rgba(0,0,0,0.7) 40%, 
                    ${colors.hexPrimary}40 70%,
                    ${colors.hexAccent}30 100%)`
                }}
              />
              <div className="absolute inset-0 opacity-10" style={{
                backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                backgroundSize: '16px 16px'
              }} />
            </div>

            {/* Contenido de la tarjeta */}
            <div className="relative h-full p-3 sm:p-4 md:p-5 flex flex-col">
              {/* Header: Logo + QR */}
              <div className="flex justify-between items-start gap-2">
                <div 
                  className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] md:text-xs font-black backdrop-blur-md border-2"
                  style={{ 
                    background: 'rgba(0,0,0,0.6)',
                    borderColor: colors.hexAccent,
                    color: colors.hexAccent,
                    letterSpacing: '0.5px'
                  }}
                >
                  BOOSTIFY
                </div>
                <div className="bg-white p-1 sm:p-1.5 rounded-lg shadow-2xl flex-shrink-0">
                  <QRCode
                    value={profileUrl}
                    size={56}
                    level="H"
                    fgColor="#000000"
                    bgColor="#ffffff"
                    style={{ width: '100%', height: 'auto', maxWidth: 56 }}
                  />
                </div>
              </div>

              {/* Centro: Nombre + info */}
              <div className="flex-1 flex items-center justify-center px-1 sm:px-2 py-1">
                <div className="text-center w-full space-y-0.5 sm:space-y-1">
                  {/* Decorador */}
                  <div className="flex items-center justify-center gap-1.5 mb-0.5 sm:mb-1">
                    <div className="h-[1px] w-6 sm:w-10 md:w-14" style={{ background: `linear-gradient(90deg, transparent, ${colors.hexAccent}, transparent)` }} />
                    <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke={colors.hexAccent} viewBox="0 0 24 24" style={{ filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.4))' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    <div className="h-[1px] w-6 sm:w-10 md:w-14" style={{ background: `linear-gradient(90deg, transparent, ${colors.hexAccent}, transparent)` }} />
                  </div>

                  {/* Nombre */}
                  <h3 
                    className={`font-black leading-none break-words ${
                      artist.name.length > 30 
                        ? 'text-sm sm:text-base md:text-lg lg:text-xl' 
                        : artist.name.length > 20 
                          ? 'text-base sm:text-lg md:text-xl lg:text-2xl' 
                          : artist.name.length > 12 
                            ? 'text-lg sm:text-xl md:text-2xl lg:text-3xl'
                            : 'text-xl sm:text-2xl md:text-3xl lg:text-4xl'
                    }`}
                    style={{
                      backgroundImage: `linear-gradient(135deg, #ffffff 0%, ${colors.hexAccent} 50%, #ffffff 100%)`,
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.9))',
                      wordBreak: 'break-word',
                      hyphens: 'auto',
                      letterSpacing: '-0.02em'
                    }}
                  >
                    {artist.name}
                  </h3>
                  
                  {/* G�nero */}
                  {artist.genre && (
                    <div className="flex items-center justify-center gap-1.5">
                      <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill={colors.hexAccent} viewBox="0 0 24 24">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                      </svg>
                      <p 
                        className="text-[10px] sm:text-xs md:text-sm font-bold tracking-wide uppercase" 
                        style={{ 
                          backgroundImage: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.6))'
                        }}
                      >
                        {artist.genre}
                      </p>
                    </div>
                  )}

                  {/* Mini biograf�a */}
                  {artist.biography && (
                    <div className="px-1 sm:px-2 mt-1">
                      <p 
                        className="text-[8px] sm:text-[10px] md:text-xs leading-snug text-white/85 line-clamp-2 backdrop-blur-sm bg-black/30 rounded-md px-2 py-1 sm:py-1.5 border border-white/10"
                        style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                      >
                        {artist.biography.length > 100 
                          ? `${artist.biography.substring(0, 100)}...` 
                          : artist.biography}
                      </p>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="flex items-center justify-center gap-2 sm:gap-3 mt-1 sm:mt-2 text-white/80">
                    <div className="flex items-center gap-0.5 backdrop-blur-sm bg-black/30 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full border border-white/10">
                      <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill={colors.hexAccent} viewBox="0 0 24 24">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                      </svg>
                      <span className="text-[8px] sm:text-[9px] md:text-xs font-bold">{artist.followers > 1000 ? `${(artist.followers / 1000).toFixed(1)}K` : artist.followers}</span>
                    </div>
                    <div className="flex items-center gap-0.5 backdrop-blur-sm bg-black/30 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full border border-white/10">
                      <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill={colors.hexAccent} viewBox="0 0 24 24">
                        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                      </svg>
                      <span className="text-[8px] sm:text-[9px] md:text-xs font-bold">Artist</span>
                    </div>
                    <div className="flex items-center gap-0.5 backdrop-blur-sm bg-black/30 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-full border border-white/10">
                      <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill={colors.hexAccent} viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                      </svg>
                      <span className="text-[8px] sm:text-[9px] md:text-xs font-bold">Verified</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Barra decorativa inferior */}
              <div 
                className="absolute bottom-0 left-0 right-0 h-1.5 sm:h-2 md:h-3"
                style={{
                  background: `linear-gradient(90deg, ${colors.hexPrimary} 0%, ${colors.hexAccent} 50%, ${colors.hexPrimary} 100%)`
                }}
              />
            </div>
          </div>

          {/* Bot�n de descarga */}
          <button
            onClick={handleDownloadCard}
            className="w-full py-2.5 sm:py-3 px-4 sm:px-6 rounded-xl font-semibold text-sm sm:text-base transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2"
            style={{
              backgroundColor: colors.hexPrimary,
              color: 'white',
              boxShadow: `0 4px 14px ${colors.hexPrimary}50`
            }}
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Artist Card
          </button>

          <button
            onClick={handleAddToWallet}
            className="w-full py-2.5 sm:py-3 px-4 sm:px-6 rounded-xl font-semibold text-sm sm:text-base transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2 bg-black/50 border border-white/20 text-white"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a5 5 0 00-10 0v2M5 9h14l-1 10H6L5 9zm7 4v3m-3-3h6" />
            </svg>
            Add to Phone Wallet
          </button>

          {/* Hidden fixed-size export card (ID-1 ratio at high resolution) */}
          <div className="fixed -left-[99999px] -top-[99999px] pointer-events-none" aria-hidden>
            <div
              ref={exportCardRef}
              style={{
                width: '1011px',
                height: '638px',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '36px',
                background: '#05070A',
                fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
              }}
            >
              {/* Use background-image instead of <img> so html2canvas respects
                  background-size:cover + background-position correctly.
                  A data URL is used to avoid CORS issues. */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: `url(${exportBgDataUrl || artist.profileImage})`,
                  backgroundSize: 'cover',
                  backgroundPosition: imagePosition,
                  backgroundRepeat: 'no-repeat',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: `linear-gradient(135deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.72) 42%, ${colors.hexPrimary}55 72%, ${colors.hexAccent}45 100%)`,
                }}
              />

              <div style={{ position: 'relative', zIndex: 2, height: '100%', padding: '34px 38px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '0.12em', color: colors.hexAccent, border: `2px solid ${colors.hexAccent}`, padding: '8px 16px', borderRadius: '999px', background: 'rgba(0,0,0,0.45)' }}>
                    BOOSTIFY
                  </div>
                  <div style={{ background: '#fff', padding: '10px', borderRadius: '14px' }}>
                    <QRCode value={profileUrl} size={138} level="H" fgColor="#000000" bgColor="#ffffff" />
                  </div>
                </div>

                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                  <div style={{ width: '100%' }}>
                    <h3 style={{ margin: 0, fontSize: '72px', fontWeight: 900, lineHeight: 1.02, letterSpacing: '-0.02em', color: '#ffffff', textShadow: '0 10px 24px rgba(0,0,0,0.55)' }}>
                      {artist.name}
                    </h3>
                    {artist.genre ? (
                      <p style={{ margin: '14px 0 0 0', fontSize: '24px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.hexAccent }}>
                        {artist.genre}
                      </p>
                    ) : null}
                    {artist.biography ? (
                      <p style={{ margin: '18px auto 0 auto', maxWidth: '82%', fontSize: '19px', lineHeight: 1.35, color: 'rgba(255,255,255,0.92)', background: 'rgba(0,0,0,0.38)', border: '1px solid rgba(255,255,255,0.16)', borderRadius: '12px', padding: '10px 14px' }}>
                        {String(artist.biography).slice(0, 150)}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '18px', background: `linear-gradient(90deg, ${colors.hexPrimary} 0%, ${colors.hexAccent} 50%, ${colors.hexPrimary} 100%)` }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Card packages for physical artist cards (printed via Printful Kiss-Cut Stickers)
const CARD_PACKAGES = [
  { id: 'card-5', quantity: 5, price: 19.99, label: 'Starter', perUnit: '$4.00/card' },
  { id: 'card-10', quantity: 10, price: 34.99, label: 'Pro', perUnit: '$3.50/card', popular: true },
  { id: 'card-25', quantity: 25, price: 79.99, label: 'Event Pack', perUnit: '$3.20/card' },
];

function PhysicalCardsWidget({ artist, colors, profileUrl, cardStyles }: { artist: any, colors: any, profileUrl: string, cardStyles: string }) {
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('');
  const cardDesignRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Generate high-res card design image and upload to Firebase Storage
  const generateAndUploadCardDesign = async (): Promise<string> => {
    const element = cardDesignRef.current;
    if (!element) throw new Error('Card design element not ready');

    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(element, {
      scale: 3,
      useCORS: true,
      allowTaint: false,
      backgroundColor: null,
      width: 420,
      height: 265,
    });

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b: Blob | null) => (b ? resolve(b) : reject(new Error('Image generation failed'))),
        'image/png',
      );
    });

    const storagePath = `artist-cards/${encodeURIComponent(artist.name)}/${Date.now()}.png`;
    const storageRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(storageRef, blob);
    return await getDownloadURL(snapshot.ref);
  };

  const handleOrderCards = async (pkg: typeof CARD_PACKAGES[0]) => {
    try {
      setIsProcessing(true);

      // Step 1 � generate the card design as PNG & upload to Firebase
      setStatusText('Generating card design...');
      const designUrl = await generateAndUploadCardDesign();

      // Step 2 � create Stripe checkout session
      setStatusText('Opening checkout...');
      const checkoutUrl = '/api/artist-profile/create-checkout-session';

      const response = await fetch(checkoutUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: `${artist.name} Artist Card (${pkg.quantity}-pack)`,
          productPrice: pkg.price,
          productImage: designUrl,
          artistName: artist.name,
          productId: pkg.id,
          productType: 'ArtistCard',
          size: `${pkg.quantity} cards`,
          quantity: pkg.quantity,
          profileUrl,
        }),
      });

      const result = await response.json();

      if (result.success && result.url) {
        window.location.href = result.url;
      } else {
        throw new Error(result.error || 'Error creating checkout');
      }
    } catch (error: any) {
      logger.error('Error ordering cards:', error);
      toast({
        title: 'Error',
        description: error.message || 'Could not process order',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
      setStatusText('');
    }
  };

  return (
    <div
      className={`${cardStyles} overflow-hidden`}
      style={{
        borderColor: colors.hexBorder,
        borderWidth: '2px',
        background: `linear-gradient(135deg, ${colors.hexPrimary}15 0%, ${colors.hexAccent}10 100%)`,
      }}
    >
      {/* -- Hidden card design for Printful capture (off-screen) -- */}
      <div
        aria-hidden="true"
        style={{ position: 'fixed', top: 0, left: 0, width: 420, overflow: 'hidden', pointerEvents: 'none', opacity: 0.01, zIndex: -9999 }}
      >
        <div
          ref={cardDesignRef}
          style={{ width: 420, height: 265, position: 'relative', overflow: 'hidden', borderRadius: 16 }}
        >
          {/* Background image + overlays */}
          <div style={{ position: 'absolute', inset: 0 }}>
            <img
              src={artist.profileImage}
              alt=""
              crossOrigin="anonymous"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 30%' }}
            />
            <div
              style={{
                position: 'absolute', inset: 0,
                background: `linear-gradient(135deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.7) 40%, ${colors.hexPrimary}40 70%, ${colors.hexAccent}30 100%)`,
              }}
            />
            <div
              style={{
                position: 'absolute', inset: 0, opacity: 0.1,
                backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
                backgroundSize: '16px 16px',
              }}
            />
          </div>
          {/* Content */}
          <div style={{ position: 'relative', height: '100%', padding: 20, display: 'flex', flexDirection: 'column' }}>
            {/* Header � BOOSTIFY badge + QR */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div
                style={{
                  padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 900,
                  background: 'rgba(0,0,0,0.6)', border: `2px solid ${colors.hexAccent}`,
                  color: colors.hexAccent, letterSpacing: '0.5px',
                }}
              >
                BOOSTIFY
              </div>
              <div style={{ background: 'white', padding: 6, borderRadius: 8 }}>
                <QRCode value={profileUrl} size={56} level="H" fgColor="#000000" bgColor="#ffffff" />
              </div>
            </div>
            {/* Center � artist name + genre + stats */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px 8px' }}>
              <div style={{ textAlign: 'center', width: '100%' }}>
                {/* Decorator */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
                  <div style={{ height: 1, width: 56, background: `linear-gradient(90deg, transparent, ${colors.hexAccent}, transparent)` }} />
                  <svg width="16" height="16" fill="none" stroke={colors.hexAccent} viewBox="0 0 24 24" style={{ filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.4))' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  <div style={{ height: 1, width: 56, background: `linear-gradient(90deg, transparent, ${colors.hexAccent}, transparent)` }} />
                </div>
                {/* Artist name */}
                <h3
                  style={{
                    fontSize: 32, fontWeight: 900, lineHeight: 1, margin: 0,
                    backgroundImage: `linear-gradient(135deg, #ffffff 0%, ${colors.hexAccent} 50%, #ffffff 100%)`,
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.9))',
                    wordBreak: 'break-word', letterSpacing: '-0.02em',
                  }}
                >
                  {artist.name}
                </h3>
                {/* Genre */}
                {artist.genre && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}>
                    <svg width="12" height="12" fill={colors.hexAccent} viewBox="0 0 24 24">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                    </svg>
                    <p
                      style={{
                        fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0,
                        backgroundImage: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                      }}
                    >
                      {artist.genre}
                    </p>
                  </div>
                )}
                {/* Stats */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 8, color: 'rgba(255,255,255,0.8)' }}>
                  {[
                    { icon: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z', label: artist.followers > 1000 ? `${(artist.followers / 1000).toFixed(1)}K` : String(artist.followers ?? 0) },
                    { icon: 'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z', label: 'Artist' },
                    { icon: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z', label: 'Verified' },
                  ].map(s => (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.1)' }}>
                      <svg width="10" height="10" fill={colors.hexAccent} viewBox="0 0 24 24"><path d={s.icon} /></svg>
                      <span style={{ fontSize: 10, fontWeight: 700 }}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Bottom gradient bar */}
            <div
              style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: 8,
                background: `linear-gradient(90deg, ${colors.hexPrimary} 0%, ${colors.hexAccent} 50%, ${colors.hexPrimary} 100%)`,
              }}
            />
          </div>
        </div>
      </div>

      {/* -- Visible widget UI -- */}
      <div className="relative">
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 mb-4">
          <div
            className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
              boxShadow: `0 8px 20px ${colors.hexPrimary}40`,
            }}
          >
            <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h3 className="text-base sm:text-lg font-bold text-white mb-0.5">Premium Physical Cards</h3>
            <p className="text-xs sm:text-sm text-gray-400">Printed on premium vinyl via Printful</p>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          {[
            'Premium vinyl, weather & water resistant',
            'Full-color custom design with your branding',
            'QR code linking to your Boostify profile',
            'Perfect for events, shows & networking',
          ].map(text => (
            <div key={text} className="flex items-start gap-2 text-xs sm:text-sm text-gray-300">
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: colors.hexAccent }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{text}</span>
            </div>
          ))}
        </div>

        {/* Package selection */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {CARD_PACKAGES.map(pkg => (
            <button
              key={pkg.id}
              onClick={() => setSelectedPackage(pkg.id)}
              className={`relative p-2 sm:p-3 rounded-xl border-2 transition-all duration-200 text-center ${
                selectedPackage === pkg.id ? 'scale-[1.02]' : 'hover:scale-[1.01]'
              }`}
              style={{
                borderColor: selectedPackage === pkg.id ? colors.hexAccent : colors.hexBorder,
                background: selectedPackage === pkg.id ? `${colors.hexPrimary}25` : 'transparent',
              }}
            >
              {pkg.popular && (
                <div
                  className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold whitespace-nowrap"
                  style={{ background: colors.hexAccent, color: '#000' }}
                >
                  POPULAR
                </div>
              )}
              <div className="text-base sm:text-lg font-black text-white">{pkg.quantity}</div>
              <div className="text-[10px] sm:text-xs text-gray-400">cards</div>
              <div className="text-sm sm:text-base font-bold mt-1" style={{ color: colors.hexAccent }}>${pkg.price}</div>
              <div className="text-[9px] sm:text-[10px] text-gray-500">{pkg.perUnit}</div>
            </button>
          ))}
        </div>

        {/* Order button */}
        <button
          onClick={() => {
            const pkg = CARD_PACKAGES.find(p => p.id === selectedPackage);
            if (!pkg) {
              toast({ title: 'Select a package', description: 'Choose a card quantity first', variant: 'default' });
              return;
            }
            handleOrderCards(pkg);
          }}
          disabled={isProcessing || !selectedPackage}
          className="w-full py-3 sm:py-4 px-4 sm:px-6 rounded-xl font-bold text-sm sm:text-base transition-all duration-300 hover:scale-105 hover:shadow-2xl relative overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          style={{
            background: `linear-gradient(135deg, ${colors.hexPrimary} 0%, ${colors.hexAccent} 100%)`,
            color: 'white',
            boxShadow: selectedPackage ? `0 10px 30px ${colors.hexPrimary}40` : 'none',
          }}
        >
          <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
          <span className="relative flex items-center justify-center gap-2">
            {isProcessing ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                {statusText || 'Processing...'}
              </>
            ) : (
              <>
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                {selectedPackage
                  ? `Order ${CARD_PACKAGES.find(p => p.id === selectedPackage)?.quantity} Cards · $${CARD_PACKAGES.find(p => p.id === selectedPackage)?.price}`
                  : 'Select a Package'}
              </>
            )}
          </span>
        </button>

        <p className="text-[10px] sm:text-xs text-gray-500 text-center mt-3">
          📦 Shipping worldwide via Printful · Produced in 3-5 business days
        </p>
      </div>
    </div>
  );
}

// Componente para comprar producto con selecci�n de talla y Stripe Checkout
function ProductBuyButton({ product, colors, artistName }: { product: Product, colors: any, artistName: string }) {
  const [showDialog, setShowDialog] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleBuyClick = () => {
    if (!product.sizes || product.sizes.length === 0) {
      // Si no tiene tallas, comprar directamente
      handleCheckout('');
    } else if (product.sizes.length === 1) {
      // Si solo hay una talla, seleccionarla autom�ticamente
      handleCheckout(product.sizes[0]);
    } else {
      // Si hay m�ltiples tallas, mostrar di�logo
      setShowDialog(true);
    }
  };

  const handleCheckout = async (size: string) => {
    try {
      setIsProcessing(true);
      
      logger.info('?? Iniciando checkout de Stripe para:', product.name);
      
      // Express API endpoint for checkout
      const checkoutUrl = '/api/artist-profile/create-checkout-session';
      const response = await fetch(checkoutUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: product.name,
          productPrice: product.price,
          productImage: product.imageUrl,
          artistName: artistName,
          productId: product.id,
          productType: (product as any).type,
          size: size
        })
      });

      const result = await response.json();
      
      if (result.success && result.url) {
        logger.info('? Checkout session creada, redirigiendo...');
        // Redirigir a Stripe Checkout
        window.location.href = result.url;
      } else {
        throw new Error(result.error || 'Error al crear sesión de checkout');
      }
    } catch (error: any) {
      logger.error('❌ Error al procesar checkout:', error);
      toast({
        title: "Error al procesar la compra",
        description: error.message || "Intenta de nuevo más tarde",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      setShowDialog(false);
    }
  };

  return (
    <>
      {product.sizes && product.sizes.length > 0 && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {product.sizes.map((size, idx) => (
            <span 
              key={idx}
              className="text-xs px-2 py-0.5 rounded-full border"
              style={{ 
                borderColor: colors.hexBorder,
                color: colors.hexAccent 
              }}
            >
              {size}
            </span>
          ))}
        </div>
      )}
      
      <button
        onClick={handleBuyClick}
        disabled={isProcessing}
        className="mt-2 w-full py-1.5 md:py-2.5 px-3 md:px-4 rounded-full text-xs md:text-sm font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ 
          backgroundColor: colors.hexPrimary,
          color: 'white',
          boxShadow: `0 4px 14px 0 ${colors.hexPrimary}40`
        }}
        data-testid={`button-buy-${product.id}`}
      >
        {isProcessing ? (
          <span className="flex items-center justify-center gap-1 md:gap-2">
            <div className="animate-spin h-3 w-3 md:h-4 md:w-4 border-2 border-white border-t-transparent rounded-full"></div>
            <span className="hidden sm:inline">Procesando...</span>
          </span>
        ) : (
          <>
            <ShoppingCart className="h-3 w-3 md:h-4 md:w-4 inline mr-1 md:mr-2" />
            <span className="hidden sm:inline">Comprar Ahora ${product.price}</span>
            <span className="sm:hidden">${product.price}</span>
          </>
        )}
      </button>

      {/* Di�logo para seleccionar talla */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bg-gray-950 border border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white">Selecciona tu talla</DialogTitle>
            <DialogDescription className="text-gray-400">
              Elige la talla para {product.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-3 gap-2 py-4">
            {product.sizes?.map((size) => (
              <button
                key={size}
                onClick={() => setSelectedSize(size)}
                className={`py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                  selectedSize === size 
                    ? 'ring-2 scale-105' 
                    : 'hover:scale-105'
                }`}
                style={{
                  backgroundColor: selectedSize === size ? colors.hexPrimary : 'transparent',
                  borderColor: colors.hexBorder,
                  borderWidth: '1px',
                  color: selectedSize === size ? 'white' : colors.hexAccent
                }}
              >
                {size}
              </button>
            ))}
          </div>
          
          <DialogFooter>
            <Button
              onClick={() => setShowDialog(false)}
              variant="outline"
              className="border-gray-700 text-gray-400 hover:bg-gray-900"
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleCheckout(selectedSize)}
              disabled={!selectedSize || isProcessing}
              className="font-semibold"
              style={{
                backgroundColor: colors.hexPrimary,
                color: 'white'
              }}
            >
              {isProcessing ? 'Procesando...' : `Continuar con ${selectedSize}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// --- Business Plan Teaser Card -----------------------------------------------
// Shown inline in the artist profile card for all visitors (owner and public).
// Fetches just the status so it can show score + key stats + CTA link.
function BusinessPlanTeaser({
  pgArtistId,
  colors,
  cardStyles,
  cardStyleInline,
  isExpanded = true,
  onToggleExpand,
}: {
  pgArtistId: number;
  colors: { hexPrimary: string; hexAccent: string; hexBorder: string };
  cardStyles: string;
  cardStyleInline: React.CSSProperties;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const { data } = useQuery<{ status: string; hasPlan: boolean; plan?: any }>({
    queryKey: [`/api/business-plan/${pgArtistId}/full-status`],
    queryFn: async () => {
      try {
        return await apiRequest('GET', `/api/business-plan/${pgArtistId}/full-status`);
      } catch {
        return { status: 'pending', hasPlan: false };
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const plan = data?.plan;
  const score = plan?._meta?.business_plan_score ?? null;
  const hasPlan = data?.hasPlan;

  return (
    <div className={cardStyles} style={cardStyleInline}>
      <div
        className="relative overflow-hidden rounded-xl p-5 border"
        style={{
          borderColor: colors.hexBorder,
          background: `linear-gradient(135deg, ${colors.hexPrimary}18 0%, rgba(8,12,24,0.92) 50%, ${colors.hexAccent}12 100%)`,
        }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between gap-3 mb-4"
          style={onToggleExpand ? { cursor: 'pointer' } : undefined}
          onClick={onToggleExpand || undefined}
          role={onToggleExpand ? 'button' : undefined}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${colors.hexPrimary}30`, border: `1px solid ${colors.hexPrimary}40` }}
            >
              <Briefcase className="w-5 h-5" style={{ color: colors.hexPrimary }} />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">Business Plan</h3>
              <p className="text-white/40 text-xs">AI-Generated · Investor Grade</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {score !== null && (
              <div
                className={`px-3 py-1 rounded-full border text-xs font-bold shrink-0 ${
                  score >= 75
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : score >= 50
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                }`}
              >
                {score}/100
              </div>
            )}
            {onToggleExpand && (
              isExpanded
                ? <ChevronUp className="w-4 h-4 text-white/40" />
                : <ChevronDown className="w-4 h-4 text-white/40" />
            )}
          </div>
        </div>

        {/* Plan summary or placeholder */}
        {isExpanded && (
          <>
        {hasPlan && plan ? (
          <div className="space-y-3">
            {/* Tagline */}
            {plan.executive_summary?.tagline && (
              <p className="text-white/60 text-xs italic">"{plan.executive_summary.tagline}"</p>
            )}
            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Annual Rev.', value: (() => { const n = plan.financial_plan?.annual_revenue; if (!n) return '—'; if (n >= 1e6) return `$${(n/1e6).toFixed(1)}M`; if (n >= 1e3) return `$${(n/1e3).toFixed(0)}K`; return `$${n}`; })() },
                { label: 'Investment', value: (() => { const n = plan.financial_plan?.investment_ask; if (!n) return '—'; if (n >= 1e6) return `$${(n/1e6).toFixed(1)}M`; if (n >= 1e3) return `$${(n/1e3).toFixed(0)}K`; return `$${n}`; })() },
                { label: 'Break-even', value: plan.financial_plan?.break_even_months ? `${plan.financial_plan.break_even_months}mo` : '—' },
              ].map((s, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-white/5 border border-white/10 text-center">
                  <div className="text-white/30 text-[10px] mb-0.5">{s.label}</div>
                  <div className="text-white font-bold text-xs">{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-white/40 text-xs leading-relaxed mb-3">
            {data?.status === 'generating'
              ? '⏳ Generating full Business Plan… refresh in a moment.'
              : 'No Business Plan generated yet. Open the full plan to generate one.'}
          </p>
        )}

        {/* CTA */}
        <Link href={`/business-plan/${pgArtistId}`}>
          <button
            className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-98"
            style={{
              background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
              color: 'white',
            }}
          >
            <Briefcase className="w-4 h-4" />
            {hasPlan ? 'View Full Business Plan' : 'Open Business Plan'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </Link>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Scroll-reactive parallax orbs for the artist profile background.
 * The container is fixed; each orb keeps its ambient drift AND shifts with the
 * page scroll at a different speed → a real depth/parallax feel while navigating.
 */
function ParallaxOrbs({ hexPrimary, hexAccent }: { hexPrimary: string; hexAccent: string }) {
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const smooth = useSpring(scrollYProgress, { stiffness: 80, damping: 28, mass: 0.3 });
  // Different speeds per layer create the sense of depth as the page scrolls.
  const y1 = useTransform(smooth, [0, 1], [0, -160]);
  const y2 = useTransform(smooth, [0, 1], [0, -340]);
  const y3 = useTransform(smooth, [0, 1], [0, 220]);
  const rot = useTransform(smooth, [0, 1], [0, 24]);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {/* Orb 1 – top-left, primary */}
      <motion.div className="absolute" style={{ left: '-15vw', top: '-15vw', y: reduceMotion ? 0 : y1 }}>
        <motion.div
          className="rounded-full"
          style={{ width: '65vw', height: '65vw', background: hexPrimary, opacity: 0.07, filter: 'blur(90px)' }}
          animate={{ x: [0, 80, 30, 0], y: [0, 50, 100, 0] }}
          transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
      {/* Orb 2 – right-center, accent */}
      <motion.div className="absolute" style={{ right: '-20vw', top: '25vh', y: reduceMotion ? 0 : y2, rotate: reduceMotion ? 0 : rot }}>
        <motion.div
          className="rounded-full"
          style={{ width: '55vw', height: '55vw', background: hexAccent, opacity: 0.055, filter: 'blur(110px)' }}
          animate={{ x: [0, -50, -80, 0], y: [0, 70, 20, 0] }}
          transition={{ duration: 30, repeat: Infinity, ease: 'easeInOut', delay: 5 }}
        />
      </motion.div>
      {/* Orb 3 – bottom-center, primary */}
      <motion.div className="absolute" style={{ left: '25vw', bottom: '-10vw', y: reduceMotion ? 0 : y3 }}>
        <motion.div
          className="rounded-full"
          style={{ width: '45vw', height: '45vw', background: hexPrimary, opacity: 0.045, filter: 'blur(130px)' }}
          animate={{ x: [-40, 60, 10, -40], y: [0, -70, -30, 0] }}
          transition={{ duration: 38, repeat: Infinity, ease: 'easeInOut', delay: 12 }}
        />
      </motion.div>
      {/* Subtle scanline vignette overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, transparent 40%, rgba(0,0,0,0.55) 100%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

export function ArtistProfileCard({ artistId, initialArtistData }: ArtistProfileProps) {
  const { t } = useTranslation();
  // Global audio queue (single shared <audio>; survives across sections)
  const audioPlayer = useAudioPlayer();
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const [karaokeSong, setKaraokeSong] = useState<Song | null>(null);
  const [coverDialogSong, setCoverDialogSong] = useState<Song | null>(null);
  const [promoteSongTarget, setPromoteSongTarget] = useState<Song | null>(null);
  const [promotePgId, setPromotePgId] = useState<number | null>(null);
  const [promoteResolving, setPromoteResolving] = useState(false);
  const [profileModuleCheckoutLoading, setProfileModuleCheckoutLoading] = useState<string | null>(null);

  // ── Fan monetization (pay-what-you-want catalog unlock) ──────────────────
  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [unlockPlan, setUnlockPlan] = useState<"lifetime" | "monthly">("lifetime");
  const [unlockAmount, setUnlockAmount] = useState<number>(5);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [guestFanEmail, setGuestFanEmail] = useState("");
  const [guestFanName, setGuestFanName] = useState("");

  const [autoplayBootstrapped, setAutoplayBootstrapped] = useState(false);
  // Fullscreen overlay for any module (Music, Video, Economic Engine, AI Career Suite, etc.)
  const [fullscreenSectionId, setFullscreenSectionId] = useState<string | null>(null);
  // Clean Profile UX: chrome (secondary buttons / module chips) auto-hides on mobile
  // and reappears on tap. Default visible for 4s on first paint, then fades out.
  const [chromeVisible, setChromeVisible] = useState<boolean>(true);
  const chromeHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleChromeHide = (delay = 4000) => {
    if (chromeHideTimerRef.current) clearTimeout(chromeHideTimerRef.current);
    chromeHideTimerRef.current = setTimeout(() => setChromeVisible(false), delay);
  };
  const showChrome = () => {
    setChromeVisible(true);
    scheduleChromeHide();
  };
  const toggleChrome = () => {
    if (chromeVisible) {
      if (chromeHideTimerRef.current) clearTimeout(chromeHideTimerRef.current);
      setChromeVisible(false);
    } else {
      showChrome();
    }
  };
  const [selectedTheme, setSelectedTheme] = useState<keyof typeof colorPalettes>('Boostify Naranja');
  const [themeCategory, setThemeCategory] = useState<PaletteCategory | 'all'>('all');
  const [previewTheme, setPreviewTheme] = useState<string | null>(null);
  const [showThemeSelector, setShowThemeSelector] = useState(false);

  // --- Manual Font Selection -----------------------------------------
  const [selectedFont, setSelectedFont] = useState<string>('default');

  // Inject Google Font link when selectedFont changes
  useEffect(() => {
    if (selectedFont === 'default') return;
    const opt = FONT_OPTIONS.find(f => f.key === selectedFont);
    if (!opt || !opt.gfUrl) return;
    const linkId = 'manual-profile-font';
    let linkEl = document.getElementById(linkId) as HTMLLinkElement | null;
    if (!linkEl) {
      linkEl = document.createElement('link');
      linkEl.id = linkId;
      linkEl.rel = 'stylesheet';
      document.head.appendChild(linkEl);
    }
    linkEl.href = `https://fonts.googleapis.com/css2?family=${opt.gfUrl}&display=swap`;
  }, [selectedFont]);

  // --- Photo Harmony palette extracted from profile image -----------
  const [photoPaletteEntry, setPhotoPaletteEntry] = useState<ColorPalette | null>(null);
  const [photoFont, setPhotoFont] = useState<{ heading: string; body: string } | null>(null);
  const [isExtractingPalette, setIsExtractingPalette] = useState(false);
  const [merchFilter, setMerchFilter] = useState('Todo');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Open Promote modal � if the song lives only in Firestore (string id), lazily
  // create a Postgres shadow row so the analysis pipeline can run.
  const openPromoteForSong = useCallback(async (song: Song) => {
    if (!song) return;
    // Detect Postgres songs: id is a number at runtime, OR a numeric string like "42"
    // (pgSongs fallback stores id as String(song.id)).
    const rawId = String(song.id);
    if (typeof song.id === 'number' || /^\d+$/.test(rawId)) {
      const pgId = typeof song.id === 'number' ? song.id : parseInt(rawId, 10);
      setPromotePgId(pgId);
      setPromoteSongTarget(song);
      return;
    }
    try {
      setPromoteResolving(true);
      setPromoteSongTarget(song);
      const r: any = await apiRequest({
        url: '/api/song-promotion/ensure-pg-song',
        method: 'POST',
        data: { firestoreId: String(song.id) },
      });
      if (r?.ok && typeof r.pgId === 'number') {
        setPromotePgId(r.pgId);
      } else {
        toast({ title: 'Could not prepare song for promotion', description: r?.error || 'Unknown error', variant: 'destructive' });
        setPromoteSongTarget(null);
      }
    } catch (err: any) {
      toast({ title: 'Could not prepare song for promotion', description: err?.message || String(err), variant: 'destructive' });
      setPromoteSongTarget(null);
    } finally {
      setPromoteResolving(false);
    }
  }, [toast]);
  const { user, logout, isAuthenticated } = useAuth();
  const {
    unlockedKeys: profileUnlockedKeys,
    allAccess: profileAllAccess,
    isAdmin: isModuleAdmin,
    refetch: refetchModuleAccess,
    isLoading: isModuleAccessLoading,
  } = useModuleAccess();
  const handleHeroSignIn = useCallback(() => {
    if (typeof window !== 'undefined') {
      const redirectPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      try {
        window.localStorage.setItem('auth_redirect_path', redirectPath);
      } catch (error) {
        logger.warn('Could not persist artist profile auth redirect:', error);
      }
    }
    setLocation('/auth');
  }, [setLocation]);

  const handleHeroSignOut = useCallback(async () => {
    try {
      await logout();
      setLocation('/');
    } catch (error: any) {
      logger.error('Artist profile sign out failed:', error);
      toast({
        title: 'Could not sign out',
        description: error?.message || 'Please try again.',
        variant: 'destructive',
      });
    }
  }, [logout, setLocation, toast]);
  const tierLimits = useTierLimits();
  // Discreet inline edit shortcut � opens the EditProfileDialog without
  // forcing a trip through /dashboard.
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  
  // State for song metadata modal
  const [selectedSongForMetadata, setSelectedSongForMetadata] = useState<Song | null>(null);
  
  const [isUploadingSong, setIsUploadingSong] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [songUploadProgress, setSongUploadProgress] = useState(0);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [showUploadSongDialog, setShowUploadSongDialog] = useState(false);
  const [showGenerateAISongDialog, setShowGenerateAISongDialog] = useState(false);
  // Manage songs dialog (reorder + rename)
  const [showManageSongsDialog, setShowManageSongsDialog] = useState(false);
  const [manageSongsList, setManageSongsList] = useState<Array<{ id: string | number; title: string; coverArt?: string | null }>>([]);
  const [isSavingManage, setIsSavingManage] = useState(false);
  const [isGeneratingAISong, setIsGeneratingAISong] = useState(false);
  const [aiSongPrompt, setAiSongPrompt] = useState('');
  const [aiSongMood, setAiSongMood] = useState<'energetic' | 'mellow' | 'upbeat' | 'dark' | 'romantic'>('energetic');
  // Music style intelligence: blueprint ? songs ? manual
  const [styleSource, setStyleSource] = useState<'blueprint' | 'songs' | 'manual'>('manual');
  const [blueprintStyle, setBlueprintStyle] = useState<{
    primaryGenre?: string; vocalStyle?: string; productionStyle?: string;
    influences?: string[]; moodKeywords?: string[]; lyricThemes?: string[];
    signatureSound?: string;
  } | null>(null);
  const [manualMusicStyle, setManualMusicStyle] = useState('');
  const [isFetchingStyle, setIsFetchingStyle] = useState(false);
  const [showUploadVideoDialog, setShowUploadVideoDialog] = useState(false);
  const [newSongTitle, setNewSongTitle] = useState('');
  // Bulk upload queue: list of files chosen by the artist with editable titles.
  const [bulkSongQueue, setBulkSongQueue] = useState<Array<{ id: string; file: File; title: string; album?: string; coverArt?: File | null; coverArtPreview?: string | null; status: 'pending' | 'uploading' | 'done' | 'error'; progress: number; error?: string }>>([]);
  // Default album applied to every queued bulk-upload row (editable per-row).
  const [bulkAlbumDefault, setBulkAlbumDefault] = useState<string>("");
  // Active album filter for the songs list ("" = All).
  const [activeAlbum, setActiveAlbum] = useState<string>("");
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const songFileInputRef = useRef<HTMLInputElement | null>(null);
  const [playingVideo, setPlayingVideo] = useState<Video | null>(null);
  
  const [videoUploadType, setVideoUploadType] = useState<'youtube' | 'file'>('youtube');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPassword, setVideoPassword] = useState('');
  const videoFileInputRef = useRef<HTMLInputElement | null>(null);
  const [videoPdfFile, setVideoPdfFile] = useState<File | null>(null);
  const pdfFileInputRef = useRef<HTMLInputElement | null>(null);
  const [viewingPdf, setViewingPdf] = useState<Video | null>(null);
  const [uploadingPdfForVideoId, setUploadingPdfForVideoId] = useState<string | null>(null);
  const standalonePdfRef = useRef<HTMLInputElement | null>(null);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [downloadVideoId, setDownloadVideoId] = useState<string | null>(null);
  const [downloadPasswordInput, setDownloadPasswordInput] = useState('');
  
  // Estados para drag-and-drop del layout
  const [isEditingLayout, setIsEditingLayout] = useState(false);
  const [showLayoutConfig, setShowLayoutConfig] = useState(false);
  const [layoutPresets, setLayoutPresets] = useState<ArtistProfileLayoutPreset[]>([]);
  const [presetName, setPresetName] = useState('');
  // When ON, applying a preset MERGES its modules onto the current layout
  // (adds them without turning the rest off) so presets can be combined.
  const [combinePresets, setCombinePresets] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  
  // Social Network toggle � persisted in localStorage
  const [socialNetworkEnabled, setSocialNetworkEnabled] = useState(() => {
    try { return localStorage.getItem('boostify-social-network-enabled') === 'true'; }
    catch { return false; }
  });
  const toggleSocialNetwork = () => {
    const next = !socialNetworkEnabled;
    setSocialNetworkEnabled(next);
    try { localStorage.setItem('boostify-social-network-enabled', String(next)); } catch {}
  };
  
  // Todas las secciones disponibles con metadata
  // Page mode from artist data
  const pageMode: PageMode = (initialArtistData?.pageMode || 'artist') as PageMode;
  const modeConfig = getPageModeConfig(pageMode);

  // Category badges shown in the Customize Layout modal so users know what each module is for
  const MODULE_CATEGORY: Record<string, { label: string; color: string }> = {
    'songs':              { label: 'Content',    color: '#6366f1' },
    'videos':             { label: 'Content',    color: '#6366f1' },
    'galleries':          { label: 'Content',    color: '#6366f1' },
    'downloads':          { label: 'Content',    color: '#6366f1' },
    'social-posts':       { label: 'Social',     color: '#06b6d4' },
    'social-hub':         { label: 'Social',     color: '#06b6d4' },
    'news':               { label: 'Social',     color: '#06b6d4' },
    'merchandise':        { label: 'Monetize',   color: '#10b981' },
    'fanclub':            { label: 'Community',  color: '#ec4899' },
    'tokenization':       { label: 'Monetize',   color: '#10b981' },
    'monetize-cta':       { label: 'Monetize',   color: '#10b981' },
    'earnings':           { label: 'Monetize',   color: '#10b981' },
    'crowdfunding':       { label: 'Monetize',   color: '#10b981' },
    'sponsors':           { label: 'Monetize',   color: '#10b981' },
    'explicit-content':   { label: 'Monetize',   color: '#10b981' },
    'viral-products':     { label: 'Monetize',   color: '#10b981' },
    'amazon-picks':       { label: 'Monetize',   color: '#10b981' },
    'analytics':          { label: 'Analytics',  color: '#f59e0b' },
    'audience-engine':    { label: 'Analytics',  color: '#f59e0b' },
    'observation-engine': { label: 'Analytics',  color: '#f59e0b' },
    'aas-engine':         { label: 'AI Engine',  color: '#a855f7' },
    'hermes-agent':       { label: 'AI Engine',  color: '#a855f7' },
    'agent-gateway':      { label: 'AI Engine',  color: '#a855f7' },
    'deep-brief':         { label: 'AI Engine',  color: '#a855f7' },
    'emotional-studio':   { label: 'AI Engine',  color: '#a855f7' },
    'renaissance-studio': { label: 'Studio',     color: '#ec4899' },
    'hologram':           { label: 'Studio',     color: '#ec4899' },
    'influencer-module':  { label: 'Studio',     color: '#ec4899' },
    'promo-clips':        { label: 'Studio',     color: '#ec4899' },
    'ads-campaigns':      { label: 'Marketing',  color: '#f43f5e' },
    'gamma-presentations': { label: 'Studio',    color: '#ec4899' },
    'karaoke':            { label: 'Karaoke',    color: '#a855f7' },
    'lyrics-video':       { label: 'Studio',     color: '#7c3aed' },
    'venueBooking':       { label: 'Business',   color: '#f97316' },
    'brand-collabs':      { label: 'Business',   color: '#f97316' },
    'business-plan':      { label: 'Business',   color: '#f97316' },
    'career-suite':       { label: 'Business',   color: '#f97316' },
    'artist-blueprint':   { label: 'Business',   color: '#f97316' },
    'artist-domain':      { label: 'Business',   color: '#f97316' },
    'electronic-press-kit': { label: 'Business', color: '#f97316' },
    'my-universe':          { label: 'Content',   color: '#6366f1' },
    'whatsapp-command-center': { label: 'Community', color: '#25d366' },
    'telegram-command-center': { label: 'Community', color: '#229ED9' },
    'facebook-groups-command-center': { label: 'Community', color: '#1877F2' },
    'reddit-intelligence-center': { label: 'Intelligence', color: '#FF4500' },
    'discord-fan-nation': { label: 'Community', color: '#5865F2' },
  };

  const allSections = {
    'songs': { name: getSectionLabel(pageMode, 'songs', 'Music'), icon: Music, isOwnerOnly: false },
    'fanclub': { name: 'Fan Club', icon: Heart, isOwnerOnly: false },
    'live-stage': { name: 'Boostify Live Stage', icon: Radio, isOwnerOnly: false },
    'videos': { name: getSectionLabel(pageMode, 'videos', 'Videos'), icon: VideoIcon, isOwnerOnly: false },
    'news': { name: getSectionLabel(pageMode, 'news', 'News'), icon: Newspaper, isOwnerOnly: false },
    'social-posts': { name: getSectionLabel(pageMode, 'social-posts', 'Social Posts'), icon: Share2, isOwnerOnly: false },
    'social-hub': { name: getSectionLabel(pageMode, 'social-hub', 'Broadcast Studio'), icon: Antenna, isOwnerOnly: false },
    'merchandise': { name: getSectionLabel(pageMode, 'merchandise', 'Merchandise'), icon: Package, isOwnerOnly: false },
    'galleries': { name: getSectionLabel(pageMode, 'galleries', 'Image Galleries'), icon: Images, isOwnerOnly: false },
    'downloads': { name: getSectionLabel(pageMode, 'downloads', 'Downloads'), icon: Download, isOwnerOnly: false }, // label intentionally kept in sync with render ('Downloads')
    'tokenization': { name: getSectionLabel(pageMode, 'tokenization', 'Token Assets'), icon: Coins, isOwnerOnly: true },
    'monetize-cta': { name: getSectionLabel(pageMode, 'monetize-cta', 'Monetize Your Talent'), icon: Sparkles, isOwnerOnly: false },
    'analytics': { name: getSectionLabel(pageMode, 'analytics', 'Observatory'), icon: Activity, isOwnerOnly: true },
    'earnings': { name: getSectionLabel(pageMode, 'earnings', 'Earnings'), icon: DollarSign, isOwnerOnly: true },
    'crowdfunding': { name: getSectionLabel(pageMode, 'crowdfunding', 'Crowdfunding'), icon: Target, isOwnerOnly: true },
    'sponsors': { name: getSectionLabel(pageMode, 'sponsors', 'Sponsor Acquisition'), icon: Handshake, isOwnerOnly: true },
    'venueBooking': { name: getSectionLabel(pageMode, 'venueBooking', 'Venue Booking'), icon: MapPin, isOwnerOnly: true },
    'explicit-content': { name: getSectionLabel(pageMode, 'explicit-content', 'Inner Circle'), icon: Flame, isOwnerOnly: false },
    'aas-engine': { name: 'Genesis Engine', icon: Zap, isOwnerOnly: true },
    'audience-engine': { name: 'Signal Pulse', icon: Radar, isOwnerOnly: true },
    'viral-products': { name: getSectionLabel(pageMode, 'viral-products', 'Ecosystem Drops'), icon: TrendingUp, isOwnerOnly: true },
    'brand-collabs': { name: getSectionLabel(pageMode, 'brand-collabs', 'The Forge'), icon: Handshake, isOwnerOnly: true },
    'business-plan': { name: 'Commerce Blueprint', icon: BarChart3, isOwnerOnly: false },
    'influencer-module': { name: 'Amplify Network', icon: Network, isOwnerOnly: true },
    'amazon-picks': { name: 'Amazon Cultural Picks', icon: ShoppingCart, isOwnerOnly: false },
    'career-suite': { name: 'The Atelier', icon: Brain, isOwnerOnly: true },
    'artist-blueprint': { name: 'Superstar Blueprint', icon: GraduationCap, isOwnerOnly: false },
    'artist-domain': { name: 'My Domain', icon: Globe, isOwnerOnly: true },
    'hermes-agent': { name: 'The Codex', icon: ScrollText, isOwnerOnly: true },
    'electronic-press-kit': { name: 'The Press Room', icon: BookOpen, isOwnerOnly: false },
    'agent-gateway': { name: 'The Gateway', icon: Shield, isOwnerOnly: false },
    'hologram': { name: 'HoloStage Live', icon: Layers, isOwnerOnly: false },
    'renaissance-studio': { name: 'Renaissance Studio', icon: Wand2, isOwnerOnly: false },
    'observation-engine': { name: 'Observation Engine', icon: Eye, isOwnerOnly: true },
    'deep-brief': { name: 'Deep Brief', icon: FileText, isOwnerOnly: true },
    'emotional-studio': { name: 'Emotional Studio', icon: Heart, isOwnerOnly: true },
    'promo-clips': { name: 'Promo Clips', icon: Clapperboard, isOwnerOnly: true },
    'ai-video-studio': { name: 'AI Video Studio', icon: Film, isOwnerOnly: true },
    'ads-campaigns': { name: 'Ads Campaign Manager', icon: Megaphone, isOwnerOnly: true },
    'gamma-presentations': { name: 'Gamma Presentations', icon: Monitor, isOwnerOnly: true },
    'karaoke': { name: 'Karaoke', icon: Mic2, isOwnerOnly: false },
    'lyrics-video': { name: 'Lyrics Video', icon: Clapperboard, isOwnerOnly: true },
    'avatar-talk': { name: 'Avatar Talk', icon: Bot, isOwnerOnly: false },
    'talk-to-me': { name: 'Talk To Me', icon: MessageCircle, isOwnerOnly: false },
    'whatsapp-command-center': { name: 'WhatsApp Command Center', icon: MessageCircle, isOwnerOnly: true },
    'telegram-command-center': { name: 'Telegram Command Center', icon: Send, isOwnerOnly: true },
    'facebook-groups-command-center': { name: 'Facebook Groups Autopilot', icon: Megaphone, isOwnerOnly: true },
    'reddit-intelligence-center': { name: 'Reddit Intelligence Center', icon: Flame, isOwnerOnly: true },
    'discord-fan-nation': { name: 'Discord Fan Nation', icon: MessageCircle, isOwnerOnly: true },
    'my-universe': { name: 'My Universe', icon: Globe, isOwnerOnly: false },
    'vinyl-records': { name: 'Vinyl Records', icon: Disc3, isOwnerOnly: false },
    'vinyl-editions': { name: 'Vinyl Tokens', icon: Disc3, isOwnerOnly: true },
    'fashion-store': { name: 'Fashion Store', icon: Shirt, isOwnerOnly: false },
    'art-gallery': { name: 'Art Gallery', icon: Palette, isOwnerOnly: false },
    'smart-merch': { name: 'Smart Merch', icon: QrCode, isOwnerOnly: false },
  };

  // Section-level module pricing gates for Artist Profile.
  // IMPORTANT: In this profile context, only admin has full access by default.
  // Subscription does not auto-open these sections; user needs explicit unlock.
  const profileSectionToModuleKey: Record<string, string> = {
    'analytics': 'analytics-observatory',
    'tokenization': 'tokenization',
    'karaoke': 'karaoke-studio',
    'fashion-store': 'fashion-store',
    'hologram': 'hologram-show-engine',
    'influencer-module': 'ai-agents',
    'lyrics-video': 'music-video-creator',
    'ai-video-studio': 'music-video-creator',
    'brand-collabs': 'virtual-record-label',
    'business-plan': 'virtual-record-label',
    'artist-blueprint': 'artist-generator',
    'career-suite': 'ai-agents',
  };
  
  // Right column widget definitions
  const rightWidgets: Record<string, { name: string; icon: any }> = {
    'qr-card': { name: getWidgetLabel(pageMode, 'qr-card', 'Artist QR Card'), icon: QrCode },
    'physical-cards': { name: getWidgetLabel(pageMode, 'physical-cards', 'Physical Cards'), icon: CreditCard },
    'statistics': { name: getWidgetLabel(pageMode, 'statistics', 'Profile Statistics'), icon: BarChart3 },
    'tokenized-music': { name: getWidgetLabel(pageMode, 'tokenized-music', 'Tokenized Music'), icon: Coins },
    'information': { name: getWidgetLabel(pageMode, 'information', 'Information'), icon: Info },
    'social-media': { name: getWidgetLabel(pageMode, 'social-media', 'Social Media'), icon: Globe },
    'spotify': { name: getWidgetLabel(pageMode, 'spotify', 'Spotify'), icon: Headphones },
    'premium-tools': { name: getWidgetLabel(pageMode, 'premium-tools', 'Premium Tools'), icon: Gem },
    'upcoming-shows': { name: getWidgetLabel(pageMode, 'upcoming-shows', 'Upcoming Shows'), icon: Calendar },
    'economic-engine': { name: getWidgetLabel(pageMode, 'economic-engine', 'Revenue Engine'), icon: Wallet },
    'crypto-community': { name: getWidgetLabel(pageMode, 'crypto-community', 'Crypto Community'), icon: Users },
    'concert-hub': { name: getWidgetLabel(pageMode, 'concert-hub', 'Concert Center'), icon: Music },
  };
  const defaultRightOrder = ['qr-card', 'economic-engine', 'crypto-community', 'physical-cards', 'statistics', 'tokenized-music', 'information', 'social-media', 'spotify', 'premium-tools', 'upcoming-shows', 'concert-hub'];

  const defaultOrder = ['renaissance-studio', 'influencer-module', 'songs', 'fanclub', 'live-stage', 'karaoke', 'lyrics-video', 'avatar-talk', 'talk-to-me', 'whatsapp-command-center', 'telegram-command-center', 'facebook-groups-command-center', 'reddit-intelligence-center', 'discord-fan-nation', 'videos', 'promo-clips', 'ai-video-studio', 'ads-campaigns', 'gamma-presentations', 'social-hub', 'news', 'social-posts', 'merchandise', 'fashion-store', 'smart-merch', 'art-gallery', 'vinyl-records', 'vinyl-editions', 'amazon-picks', 'galleries', 'downloads', 'tokenization', 'monetize-cta', 'analytics', 'earnings', 'crowdfunding', 'sponsors', 'venueBooking', 'explicit-content', 'aas-engine', 'audience-engine', 'viral-products', 'brand-collabs', 'career-suite', 'business-plan', 'artist-blueprint', 'emotional-studio', 'artist-domain', 'hermes-agent', 'agent-gateway', 'electronic-press-kit', 'hologram', 'observation-engine', 'deep-brief', 'my-universe'];

  // Broadcast Studio layout presets � each defines a curated set of active modules
  const STUDIO_PRESETS: Array<{ id: string; label: string; vis: Record<string, boolean> }> = [
    {
      id: 'musician', label: 'Musician',
      vis: { songs: true, videos: true, galleries: true, merchandise: true, 'social-hub': true,
        hologram: true, 'renaissance-studio': true, 'electronic-press-kit': false,
        news: false, 'social-posts': false, downloads: false, tokenization: false,
        'monetize-cta': false, analytics: false, earnings: false, crowdfunding: false,
        sponsors: false, venueBooking: false, 'explicit-content': false, 'aas-engine': false,
        'audience-engine': false, 'viral-products': false, 'brand-collabs': false,
        'business-plan': false, 'influencer-module': false, 'amazon-picks': false,
        'career-suite': false, 'artist-blueprint': false, 'artist-domain': false,
        'hermes-agent': false, 'agent-gateway': false, 'observation-engine': false, 'deep-brief': false },
    },
    {
      id: 'creator', label: 'Creator',
      vis: { songs: true, videos: true, 'social-posts': true, news: true, 'social-hub': true,
        'audience-engine': true, 'influencer-module': true, analytics: true,
        galleries: false, merchandise: false, downloads: false, tokenization: false,
        'monetize-cta': false, earnings: false, crowdfunding: false, sponsors: false,
        venueBooking: false, 'explicit-content': false, 'aas-engine': false,
        'viral-products': false, 'brand-collabs': false, 'business-plan': false,
        'amazon-picks': false, 'career-suite': false, 'artist-blueprint': false,
        'artist-domain': false, 'hermes-agent': false, 'agent-gateway': false,
        'electronic-press-kit': false, hologram: false, 'renaissance-studio': false,
        'observation-engine': false, 'deep-brief': false },
    },
    {
      id: 'business', label: 'Business',
      vis: { songs: true, videos: false, 'social-hub': true, merchandise: true,
        'monetize-cta': true, analytics: true, 'audience-engine': true, 'brand-collabs': true,
        'business-plan': true, 'career-suite': true, 'artist-blueprint': true,
        'agent-gateway': true, 'observation-engine': true, earnings: true,
        news: false, 'social-posts': false, galleries: false, downloads: false,
        tokenization: false, crowdfunding: false, sponsors: false, venueBooking: false,
        'explicit-content': false, 'aas-engine': false, 'viral-products': false,
        'influencer-module': false, 'amazon-picks': false, 'artist-domain': false,
        'hermes-agent': false, 'electronic-press-kit': false, hologram: false,
        'renaissance-studio': false, 'deep-brief': false },
    },
    {
      id: 'full', label: 'Full Stage',
      vis: Object.fromEntries(defaultOrder.map(id => [id, true])) as Record<string, boolean>,
    },
    {
      id: 'minimal', label: 'Minimal',
      vis: Object.fromEntries(defaultOrder.map(id =>
        ['songs', 'videos', 'galleries', 'social-hub'].includes(id) ? [id, true] : [id, false]
      )) as Record<string, boolean>,
    },
  ];
  // Minimal default visibility: only the core creator modules are on by
  // default so new users land on a clean profile (music � video � gallery).
  // Everything else stays available behind Customize Layout � opt-in only.
  const defaultVisibility: Record<string, boolean> = {
    // Default ON for new profiles: Music, Videos, Galleries, Karaoke
    'songs': true,
    'fanclub': true,
    'live-stage': true,
    'videos': true,
    'galleries': true,
    'karaoke': true,
    // Everything else OFF — artist activates them when needed
    'news': false,
    'social-posts': false,
    'social-hub': false,
    'merchandise': false,
    'downloads': false,
    'tokenization': false,
    'monetize-cta': false,
    'analytics': false,
    'earnings': false,
    'crowdfunding': false,
    'sponsors': false,
    'venueBooking': false,
    'explicit-content': false,
    'aas-engine': false,
    'audience-engine': false,
    'viral-products': false,
    'brand-collabs': false,
    'business-plan': false,
    'influencer-module': false,
    'amazon-picks': false,
    'career-suite': false,
    'artist-blueprint': false,
    'emotional-studio': false,
    'artist-domain': false,
    'electronic-press-kit': false,
    'agent-gateway': false,
    'hologram': false,
    'renaissance-studio': false,
    'observation-engine': false,
    'deep-brief': false,
    'promo-clips': false,
    'ai-video-studio': false,
    'ads-campaigns': false,
    'gamma-presentations': false,
    'lyrics-video': false,
    'avatar-talk': false,
    'talk-to-me': false,
    'whatsapp-command-center': false,
    'telegram-command-center': false,
    'facebook-groups-command-center': false,
    'reddit-intelligence-center': false,
    'discord-fan-nation': false,
    'hermes-agent': false,
    'vinyl-records': false,
    'vinyl-editions': false,
    'fashion-store': true,
  };
  
  const [sectionOrder, setSectionOrder] = useState<string[]>(defaultOrder);
  const [sectionVisibility, setSectionVisibility] = useState<Record<string, boolean>>(defaultVisibility);
  // All sections collapsed by default � user opens them as needed
  const defaultExpanded: Record<string, boolean> = {
    'songs': false,
    'fanclub': true,
    'live-stage': false,
    'videos': false,
    'news': false,
    'social-posts': false,
    'social-hub': true,
    'merchandise': false,
    'galleries': false,
    'downloads': false,
    'tokenization': false,
    'monetize-cta': false,
    'analytics': false,
    'earnings': false,
    'crowdfunding': false,
    'sponsors': false,
    'venueBooking': false,
    'explicit-content': false,
    'aas-engine': false,
    'audience-engine': true,
    'viral-products': false,
    'business-plan': false,
    'influencer-module': false,
    'amazon-picks': false,
    'career-suite': true,
    'hologram': false,
    'renaissance-studio': true,
    'observation-engine': false,
    'deep-brief': false,
    'emotional-studio': false,
    'promo-clips': false,
    'ai-video-studio': false,
    'karaoke': false,
    'lyrics-video': false,
    'avatar-talk': false,
    'talk-to-me': false,
    'fashion-store': false,
  };
  const [sectionExpanded, setSectionExpanded] = useState<Record<string, boolean>>(defaultExpanded);
  const [rightOrder, setRightOrder] = useState<string[]>(defaultRightOrder);
  // Mobile-only: which column appears first when the layout collapses to a single column.
  // 'left' (default) keeps current behavior; 'right' renders the widget column on top on mobile.
  const [mobileColumnFirst, setMobileColumnFirst] = useState<'left' | 'right'>('left');
  const defaultRightExpanded: Record<string, boolean> = {
    'qr-card': true, 'economic-engine': true, 'crypto-community': true, 'physical-cards': false, 'statistics': false,
    'tokenized-music': true, 'information': true, 'social-media': true,
    'spotify': true, 'premium-tools': false, 'upcoming-shows': true, 'concert-hub': true,
  };
  const [rightExpanded, setRightExpanded] = useState<Record<string, boolean>>(defaultRightExpanded);
  const defaultRightVisibility: Record<string, boolean> = {
    // Default ON for new profiles: only Artist QR Card
    'qr-card': true,
    // Everything else OFF — artist activates them when needed
    'economic-engine': false, 'crypto-community': false, 'physical-cards': false, 'statistics': false,
    'tokenized-music': false, 'information': false, 'social-media': false,
    'spotify': false, 'premium-tools': false, 'upcoming-shows': false, 'concert-hub': false,
  };
  const [rightVisibility, setRightVisibility] = useState<Record<string, boolean>>(defaultRightVisibility);
  const [isMerchandiseExpanded, setIsMerchandiseExpanded] = useState(true);
  // Broadcast Studio drag-and-drop state
  const [studioDragOverId, setStudioDragOverId] = useState<string | null>(null);
  const studioDraggedRef = useRef<{ id: string; side: 'left' | 'right' } | null>(null);

  // Per-module column override: lets ANY module live on the left OR right column
  // (regardless of its natural side) so artists fill empty PC gaps freely.
  // Empty/absent value => use the module's natural side.
  const [sideOverride, setSideOverride] = useState<Record<string, 'left' | 'right'>>({});
  // Live references to the column renderers + the DOM slots where relocated
  // modules are portaled. The renderers are assigned during render of each
  // column; the slots receive cross-column modules at the bottom of the target
  // column (filling the gap). relocTick forces one extra render after mount so
  // the portal targets (refs) are attached before we read them.
  const sectionRendererRef = useRef<((sectionId: string, index: number, isStatic?: boolean) => React.ReactNode) | null>(null);
  const widgetRendererRef = useRef<((widgetId: string, index: number, isStatic?: boolean) => React.ReactNode) | null>(null);
  const leftRelocSlotRef = useRef<HTMLDivElement | null>(null);
  const rightRelocSlotRef = useRef<HTMLDivElement | null>(null);
  const [relocTick, setRelocTick] = useState(0);
  // A module's natural side: right-column widgets are 'right', everything else 'left'.
  const naturalSideOf = useCallback((id: string): 'left' | 'right' => (rightWidgets[id] ? 'right' : 'left'), []);
  const sideOf = useCallback((id: string): 'left' | 'right' => sideOverride[id] || naturalSideOf(id), [sideOverride, naturalSideOf]);
  // Move a module to a given column (clears the override when it matches the natural side).
  const setModuleSide = useCallback((id: string, side: 'left' | 'right') => {
    setSideOverride(prev => {
      const next = { ...prev };
      if (side === naturalSideOf(id)) delete next[id]; else next[id] = side;
      return next;
    });
  }, [naturalSideOf]);
  // Auto-balance: spread the visible content sections across both columns so the
  // PC layout has no large empty gap. Widgets keep their natural right side.
  const autoBalanceColumns = useCallback(() => {
    const visibleSections = sectionOrder.filter(id => sectionVisibility[id]);
    const half = Math.ceil(visibleSections.length / 2);
    const next: Record<string, 'left' | 'right'> = {};
    visibleSections.forEach((id, i) => { if (i >= half) next[id] = 'right'; });
    setSideOverride(next);
  }, [sectionOrder, sectionVisibility]);

  // (pin removed � artists can now toggle career-suite, artist-blueprint, business-plan, agent-gateway freely)
  
  // Galleries refresh key
  const [galleriesRefreshKey, setGalleriesRefreshKey] = useState(0);
  
  // News article modal state
  const [selectedArticle, setSelectedArticle] = useState<any | null>(null);
  const [isNewsModalOpen, setIsNewsModalOpen] = useState(false);
  const [isInformationBioExpanded, setIsInformationBioExpanded] = useState(false);
  
  // Debounced auto-save for layout changes
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Layout has been hydrated from the server. We use this to suppress the
  // first auto-save that would otherwise fire on initial mount/load and
  // overwrite the user's stored visibility with the default values.
  const hasHydratedLayoutRef = useRef(false);
  // Tracks whether the layout came from the DB or is a fresh default.
  // 'db' = loaded from saved profileLayout → never apply data-aware overrides.
  // 'default' = no saved layout → data-aware visibility should be applied after data loads.
  const layoutSourceRef = useRef<'db' | 'default' | null>(null);
  // Latest-state refs so the debounced auto-save body never sees stale
  // closure values (the previous implementation had a race between the
  // useEffect-driven auto-save and the useCallback closure rebuild).
  const layoutStateRef = useRef({
    sectionOrder: [] as string[],
    sectionVisibility: {} as Record<string, boolean>,
    sectionExpanded: {} as Record<string, boolean>,
    rightOrder: [] as string[],
    rightVisibility: {} as Record<string, boolean>,
    rightExpanded: {} as Record<string, boolean>,
    selectedTheme: '' as string,
    customBlocks: {} as Record<string, CustomBlock>,
    mobileColumnFirst: 'left' as 'left' | 'right',
    sideOverride: {} as Record<string, 'left' | 'right'>,
    selectedFont: 'default' as string,
    layoutPresets: [] as ArtistProfileLayoutPreset[],
  });
  // Custom user-defined blocks (text / separator / banner / custom section).
  // Their ids live inside `sectionOrder` so they reorder/hide like any section.
  const [customBlocks, setCustomBlocks] = useState<Record<string, CustomBlock>>({});
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [isGeneratingAutoBlocks, setIsGeneratingAutoBlocks] = useState(false);

  const normalizeLayoutSnapshot = useCallback((layout: any): ArtistProfileLayoutSnapshot => {
    const rawOrder = Array.isArray(layout?.order) && layout.order.length > 0
      ? layout.order.filter((id: unknown): id is string => typeof id === 'string')
      : defaultOrder;
    const order = [...rawOrder, ...defaultOrder.filter(sectionId => !rawOrder.includes(sectionId))];

    const visibility = layout?.visibility && typeof layout.visibility === 'object' && !Array.isArray(layout.visibility)
      ? { ...defaultVisibility, ...layout.visibility }
      : { ...getDefaultVisibility(pageMode) };

    const expanded = layout?.expanded && typeof layout.expanded === 'object' && !Array.isArray(layout.expanded)
      ? { ...defaultExpanded, ...layout.expanded }
      : { ...defaultExpanded };

    const rawRightOrder = Array.isArray(layout?.rightOrder) && layout.rightOrder.length > 0
      ? layout.rightOrder.filter((id: unknown): id is string => typeof id === 'string')
      : defaultRightOrder;
    const rightOrderNormalized = [
      ...rawRightOrder,
      ...defaultRightOrder.filter(widgetId => !rawRightOrder.includes(widgetId)),
    ];

    const rightExpandedNormalized = layout?.rightExpanded && typeof layout.rightExpanded === 'object' && !Array.isArray(layout.rightExpanded)
      ? { ...defaultRightExpanded, ...layout.rightExpanded }
      : { ...defaultRightExpanded };

    const rightVisibilityNormalized = layout?.rightVisibility && typeof layout.rightVisibility === 'object' && !Array.isArray(layout.rightVisibility)
      ? { ...defaultRightVisibility, ...layout.rightVisibility }
      : { ...defaultRightVisibility };

    const mobileFirst = layout?.mobileColumnFirst === 'right' ? 'right' : 'left';

    const rawSideOverride = layout?.sideOverride && typeof layout.sideOverride === 'object' && !Array.isArray(layout.sideOverride)
      ? layout.sideOverride
      : {};
    const cleanedSideOverride: Record<string, 'left' | 'right'> = {};
    for (const [key, value] of Object.entries(rawSideOverride)) {
      if (value === 'left' || value === 'right') cleanedSideOverride[key] = value;
    }

    const theme = layout?.colorTheme && (layout.colorTheme in colorPalettes || layout.colorTheme === 'Photo Harmony')
      ? layout.colorTheme
      : 'Boostify Naranja';

    const fontKey = layout?.fontKey && FONT_OPTIONS.some(font => font.key === layout.fontKey)
      ? layout.fontKey
      : 'default';

    const savedBlocks = layout?.customBlocks && typeof layout.customBlocks === 'object' && !Array.isArray(layout.customBlocks)
      ? (layout.customBlocks as Record<string, CustomBlock>)
      : {};

    return {
      order,
      visibility,
      expanded,
      rightOrder: rightOrderNormalized,
      rightExpanded: rightExpandedNormalized,
      rightVisibility: rightVisibilityNormalized,
      colorTheme: theme,
      fontKey,
      customBlocks: savedBlocks,
      mobileColumnFirst: mobileFirst,
      sideOverride: cleanedSideOverride,
    };
  }, [defaultExpanded, defaultOrder, defaultRightExpanded, defaultRightOrder, defaultRightVisibility, defaultVisibility, pageMode]);

  const normalizeLayoutPresets = useCallback((value: any): ArtistProfileLayoutPreset[] => {
    if (!Array.isArray(value)) return [];

    return value
      .map((preset: any, index: number) => {
        const trimmedName = typeof preset?.name === 'string' ? preset.name.trim() : '';
        if (!trimmedName) return null;
        const createdAt = Number.isFinite(Number(preset?.createdAt)) ? Number(preset.createdAt) : Date.now() + index;
        const updatedAt = Number.isFinite(Number(preset?.updatedAt)) ? Number(preset.updatedAt) : createdAt;
        return {
          id: typeof preset?.id === 'string' && preset.id.trim() ? preset.id : `layout-preset-${createdAt}-${index}`,
          name: trimmedName,
          createdAt,
          updatedAt,
          layout: normalizeLayoutSnapshot(preset?.layout || {}),
        } as ArtistProfileLayoutPreset;
      })
      .filter((preset): preset is ArtistProfileLayoutPreset => !!preset)
      .slice(0, MAX_LAYOUT_PRESETS);
  }, [normalizeLayoutSnapshot]);

  const applyLayoutSnapshot = useCallback((layout: any) => {
    const normalized = normalizeLayoutSnapshot(layout);
    setSectionOrder(normalized.order);
    setSectionVisibility(normalized.visibility);
    setSectionExpanded(normalized.expanded);
    setRightOrder(normalized.rightOrder);
    setRightExpanded(normalized.rightExpanded);
    setRightVisibility(normalized.rightVisibility);
    setMobileColumnFirst(normalized.mobileColumnFirst);
    setSideOverride(normalized.sideOverride);
    setSelectedTheme(normalized.colorTheme as keyof typeof colorPalettes);
    setSelectedFont(normalized.fontKey);
    setCustomBlocks(normalized.customBlocks);
    return normalized;
  }, [normalizeLayoutSnapshot]);

  const buildCurrentLayoutSnapshot = useCallback((): ArtistProfileLayoutSnapshot => {
    return normalizeLayoutSnapshot({
      order: sectionOrder,
      visibility: sectionVisibility,
      expanded: sectionExpanded,
      rightOrder,
      rightExpanded,
      rightVisibility,
      colorTheme: selectedTheme,
      fontKey: selectedFont,
      customBlocks,
      mobileColumnFirst,
      sideOverride,
    });
  }, [customBlocks, mobileColumnFirst, normalizeLayoutSnapshot, rightExpanded, rightOrder, rightVisibility, sectionExpanded, sectionOrder, sectionVisibility, selectedFont, selectedTheme, sideOverride]);

  const autoSaveLayout = useCallback((newOrder?: string[], newRightOrder?: string[], theme?: string, presetsOverride?: ArtistProfileLayoutPreset[]) => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        const s = layoutStateRef.current;
        const body = {
          order: newOrder ?? s.sectionOrder,
          visibility: s.sectionVisibility,
          expanded: s.sectionExpanded,
          rightOrder: newRightOrder ?? s.rightOrder,
          rightExpanded: s.rightExpanded,
          rightVisibility: s.rightVisibility,
          colorTheme: theme ?? s.selectedTheme,
          customBlocks: s.customBlocks,
          mobileColumnFirst: s.mobileColumnFirst,
          sideOverride: s.sideOverride || {},
          fontKey: s.selectedFont ?? 'default',
          presets: presetsOverride ?? s.layoutPresets,
        };
        logger.info('?? [AUTO-SAVE LAYOUT]', { artistId, rightVisibility: body.rightVisibility });
        const res = await fetch(`/api/profile/${artistId}/layout`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          logger.error('Auto-save layout failed: HTTP', res.status, await res.text().catch(() => ''));
        }
      } catch (e) {
        logger.error('Auto-save layout failed:', e);
      }
    }, 800);
  }, [artistId]);

  const saveCurrentPreset = useCallback(() => {
    const trimmedName = presetName.trim();
    if (!trimmedName) {
      toast({ title: 'Name your preset', description: 'Type a name before saving it.', variant: 'destructive' });
      return;
    }

    const snapshot = buildCurrentLayoutSnapshot();
    const now = Date.now();
    const existing = layoutPresets.find(preset => preset.name.trim().toLowerCase() === trimmedName.toLowerCase());
    const nextPreset: ArtistProfileLayoutPreset = {
      id: existing?.id || `layout-preset-${now}`,
      name: trimmedName,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      layout: snapshot,
    };
    const nextPresets = existing
      ? layoutPresets.map(preset => preset.id === existing.id ? nextPreset : preset)
      : [nextPreset, ...layoutPresets].slice(0, MAX_LAYOUT_PRESETS);

    setLayoutPresets(nextPresets);
    setPresetName('');
    autoSaveLayout(snapshot.order, snapshot.rightOrder, snapshot.colorTheme, nextPresets);
    toast({ title: existing ? 'Preset updated' : 'Preset saved', description: `"${trimmedName}" is ready to open whenever you want.` });
  }, [autoSaveLayout, buildCurrentLayoutSnapshot, layoutPresets, presetName, toast]);

  const applyPreset = useCallback((preset: ArtistProfileLayoutPreset) => {
    const normalized = applyLayoutSnapshot(preset.layout);
    setPresetName(preset.name);
    autoSaveLayout(normalized.order, normalized.rightOrder, normalized.colorTheme, layoutPresets);
    toast({ title: 'Preset applied', description: `Opened the preset "${preset.name}".` });
  }, [applyLayoutSnapshot, autoSaveLayout, layoutPresets, toast]);

  const deletePreset = useCallback((presetId: string) => {
    const preset = layoutPresets.find(item => item.id === presetId);
    const nextPresets = layoutPresets.filter(item => item.id !== presetId);
    setLayoutPresets(nextPresets);
    autoSaveLayout(sectionOrder, rightOrder, selectedTheme as string, nextPresets);
    if (preset) {
      toast({ title: 'Preset deleted', description: `Removed "${preset.name}".` });
    }
  }, [autoSaveLayout, layoutPresets, rightOrder, sectionOrder, selectedTheme, toast]);

  // Apply a ready-made (predetermined) preset. In replace mode it swaps the
  // whole layout to the curated module set; in combine mode it MERGES the
  // preset's modules on top of the current layout (adds without removing).
  const applyPredeterminedPreset = (preset: PredeterminedLayoutPreset) => {
    const sectionSet = new Set(preset.sections);
    const widgetSet = new Set(preset.widgets);
    const merge = combinePresets && !preset.allOn;

    // Left column visibility (keep custom blocks always visible)
    setSectionVisibility(prev => {
      const next: Record<string, boolean> = { ...prev };
      Object.keys(allSections).forEach(id => {
        if (preset.allOn) next[id] = true;
        else if (sectionSet.has(id)) next[id] = true;
        else if (!merge) next[id] = false; // replace mode turns the rest off
      });
      Object.keys(prev).forEach(id => {
        if (isCustomBlockId(id)) next[id] = prev[id] ?? true;
      });
      return next;
    });

    // Bring the chosen modules to the top in the preset's order
    if (!preset.allOn) {
      setSectionOrder(prev => {
        const listed = preset.sections.filter(id => prev.includes(id));
        const rest = prev.filter(id => !sectionSet.has(id));
        return [...listed, ...rest];
      });
    }

    // Expand the first few chosen sections so content is visible right away
    setSectionExpanded(prev => {
      const next: Record<string, boolean> = { ...prev };
      if (!merge) {
        Object.keys(allSections).forEach(id => { next[id] = false; });
      }
      if (!preset.allOn) {
        preset.sections.slice(0, 4).forEach(id => { next[id] = true; });
      }
      return next;
    });

    // Right column widgets
    setRightVisibility(prev => {
      const next: Record<string, boolean> = { ...prev };
      Object.keys(rightWidgets).forEach(id => {
        if (preset.allOn) next[id] = true;
        else if (widgetSet.has(id)) next[id] = true;
        else if (!merge) next[id] = false;
      });
      return next;
    });
    if (!preset.allOn) {
      setRightOrder(prev => {
        const listed = preset.widgets.filter(id => prev.includes(id));
        const rest = prev.filter(id => !widgetSet.has(id));
        return [...listed, ...rest];
      });
    }

    // Replace mode resets column overrides so both columns rebalance cleanly;
    // combine mode keeps the artist's existing column placement.
    if (!merge) setSideOverride({});

    autoSaveLayout();
    toast({
      title: merge ? `Added "${preset.label}"` : `"${preset.label}" applied`,
      description: merge ? `Combined with your current layout — ${preset.description}` : preset.description,
    });
  };

  // Unified drag handler for both modal config and inline page drag
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination } = result;

    if (source.droppableId === 'inline-sections') {
      // Inline page drag
      const visibleIds = sectionOrder.filter(id => sectionVisibility[id] && sideOf(id) !== 'right');
      const movedId = visibleIds[source.index];
      if (!movedId) return;
      const newOrder = sectionOrder.filter(id => id !== movedId);
      const destVisibleId = visibleIds[destination.index];
      const insertIdx = destVisibleId ? newOrder.indexOf(destVisibleId) : newOrder.length;
      if (source.index < destination.index) {
        newOrder.splice(insertIdx + 1, 0, movedId);
      } else {
        newOrder.splice(insertIdx, 0, movedId);
      }
      setSectionOrder(newOrder);
      autoSaveLayout(newOrder);
    } else if (source.droppableId === 'inline-right-sections') {
      // Right column inline drag - map filtered indices back to full rightOrder
      const visibleRight = rightOrder.filter(id => {
        if (sideOf(id) === 'left') return false;
        if (id === 'physical-cards' || id === 'statistics' || id === 'premium-tools') return isOwnProfile;
        if (id === 'social-media') return !!(artist.instagram || artist.twitter || artist.youtube);
        if (id === 'spotify') return !!(artist.spotify && getSpotifyEmbedUrl(artist.spotify));
        return true;
      });
      const movedId = visibleRight[source.index];
      if (!movedId) return;
      const newRight = rightOrder.filter(id => id !== movedId);
      const destId = visibleRight[destination.index];
      const insertAt = destId ? newRight.indexOf(destId) : newRight.length;
      if (source.index < destination.index) {
        newRight.splice(insertAt + 1, 0, movedId);
      } else {
        newRight.splice(insertAt, 0, movedId);
      }
      setRightOrder(newRight);
      autoSaveLayout(sectionOrder, newRight);
    } else if (source.droppableId === 'layout-config-right') {
      // Right column reorder inside the layout config modal (full list, no visibility filter)
      const items = Array.from(rightOrder);
      const [reordered] = items.splice(source.index, 1);
      items.splice(destination.index, 0, reordered);
      setRightOrder(items);
      autoSaveLayout(sectionOrder, items);
    } else {
      // Modal config drag
      const items = Array.from(sectionOrder);
      const [reorderedItem] = items.splice(source.index, 1);
      items.splice(destination.index, 0, reorderedItem);
      setSectionOrder(items);
      autoSaveLayout(items);
    }
  };

  // Move section up/down with arrow buttons (auto-saves)
  const moveSection = (sectionId: string, direction: 'up' | 'down') => {
    const idx = sectionOrder.indexOf(sectionId);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= sectionOrder.length) return;
    const items = [...sectionOrder];
    [items[idx], items[newIdx]] = [items[newIdx], items[idx]];
    setSectionOrder(items);
    autoSaveLayout(items);
  };

  // Move right-column widget up/down (auto-saves)
  const moveRightWidget = (widgetId: string, direction: 'up' | 'down') => {
    const idx = rightOrder.indexOf(widgetId);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= rightOrder.length) return;
    const items = [...rightOrder];
    [items[idx], items[newIdx]] = [items[newIdx], items[idx]];
    setRightOrder(items);
    autoSaveLayout(sectionOrder, items);
  };

  // Guardar layout en la base de datos
  const saveLayout = async () => {
    try {
      const response = await fetch(`/api/profile/${artistId}/layout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order: sectionOrder,
          visibility: sectionVisibility,
          expanded: sectionExpanded,
          rightOrder,
          rightExpanded,
          rightVisibility,
          colorTheme: selectedTheme,
          fontKey: selectedFont,
          mobileColumnFirst,
          customBlocks,
          sideOverride,
          presets: layoutPresets,
        })
      });

      if (!response.ok) throw new Error('Failed to save layout');

      toast({
        title: '? Layout guardado',
        description: 'Los cambios se han guardado correctamente',
      });

      setIsEditingLayout(false);
      setShowLayoutConfig(false);
    } catch (error) {
      logger.error('Error saving layout:', error);
      toast({
        title: '❌ Error',
        description: 'No se pudo guardar el layout',
        variant: 'destructive'
      });
    }
  };

  // Expandir todas las secciones
  const expandAll = () => {
    const allExpanded = Object.keys(allSections).reduce((acc, key) => {
      acc[key] = true;
      return acc;
    }, {} as Record<string, boolean>);
    setSectionExpanded(allExpanded);
  };

  // Contraer todas las secciones
  const collapseAll = () => {
    const allCollapsed = Object.keys(allSections).reduce((acc, key) => {
      acc[key] = false;
      return acc;
    }, {} as Record<string, boolean>);
    allCollapsed['career-suite'] = true;
    setSectionExpanded(allCollapsed);
  };

  // Activar todas las secciones
  const activateAll = () => {
    const allActive = Object.keys(allSections).reduce((acc, key) => {
      const section = allSections[key as keyof typeof allSections];
      if (!section.isOwnerOnly || isOwnProfile) {
        acc[key] = true;
      }
      return acc;
    }, {} as Record<string, boolean>);
    setSectionVisibility(prev => ({ ...prev, ...allActive }));
  };

  // Desactivar todas las secciones
  const deactivateAll = () => {
    const allInactive = Object.keys(allSections).reduce((acc, key) => {
      acc[key] = false;
      return acc;
    }, {} as Record<string, boolean>);
    setSectionVisibility(allInactive);
  };

  // Manejar edici�n de noticia
  const handleEditNews = (article: any) => {
    toast({
      title: "Coming Soon",
      description: "News editing will be available soon",
    });
    setIsNewsModalOpen(false);
  };

  // Manejar eliminaci�n de noticia
  const handleDeleteNews = async (articleId: number) => {
    if (!confirm('Are you sure you want to delete this news?')) {
      return;
    }

    try {
      const response = await fetch(`/api/artist-generator/news/${articleId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error deleting news');
      }

      toast({
        title: "? News deleted",
        description: "The news article was deleted successfully",
      });

      // Refrescar las noticias
      queryClient.invalidateQueries({ queryKey: ['/api/artist-generator/news'] });
      setSelectedArticle(null);
      setIsNewsModalOpen(false);
    } catch (error: any) {
      logger.error('Error deleting news:', error);
      toast({
        title: "❌ Error",
        description: error.message || "Could not delete the news article",
        variant: "destructive"
      });
    }
  };

  // Manejar regeneraci�n de noticia
  const handleRegenerateNews = async (articleId: number) => {
    if (!confirm('Are you sure you want to regenerate this news? The current content will be lost.')) {
      return;
    }

    try {
      toast({
        title: "Regenerating news...",
        description: "This may take a moment",
      });

      const response = await fetch(`/api/artist-generator/news/${articleId}/regenerate`, {
        method: 'POST',
        credentials: 'include',
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error regenerating news');
      }

      toast({
        title: "? News regenerated",
        description: "The news article was regenerated successfully",
      });

      // Refrescar las noticias
      queryClient.invalidateQueries({ queryKey: ['/api/artist-generator/news'] });
      if (result?.news) {
        setSelectedArticle(result.news);
      }
      setIsNewsModalOpen(true);
    } catch (error: any) {
      logger.error('Error regenerating news:', error);
      toast({
        title: "❌ Error",
        description: error.message || "Could not regenerate the news article",
        variant: "destructive"
      });
    }
  };

  const activeTheme = previewTheme && previewTheme in colorPalettes ? previewTheme : selectedTheme;
  // Photo Harmony: use the dynamically extracted palette when selected
  const isPhotoHarmony = (activeTheme as string) === 'Photo Harmony' && photoPaletteEntry != null;
  const colors = isPhotoHarmony ? photoPaletteEntry! : (colorPalettes[activeTheme] ?? colorPalettes['Boostify Naranja']);

  // Helper function to extract Spotify Artist ID from URL
  const getSpotifyEmbedUrl = (spotifyUrl: string): string | null => {
    if (!spotifyUrl) {
      logger.info('?? Spotify URL is empty');
      return null;
    }
    
    // Match patterns like:
    // https://open.spotify.com/artist/3TVXtAsR1Inumwj472S9r4
    // open.spotify.com/artist/3TVXtAsR1Inumwj472S9r4
    const artistMatch = spotifyUrl.match(/artist\/([a-zA-Z0-9]+)/);
    
    if (artistMatch && artistMatch[1]) {
      const embedUrl = `https://open.spotify.com/embed/artist/${artistMatch[1]}?utm_source=generator`;
      logger.info('?? Spotify embed URL generated:', embedUrl);
      return embedUrl;
    }
    
    logger.info('?? Spotify URL did not match pattern:', spotifyUrl);
    return null;
  };

  // Helper function to convert YouTube URL to embed URL
  const getYouTubeEmbedUrl = (url: string): string | null => {
    if (!url) return null;
    
    // Match patterns:
    // https://www.youtube.com/watch?v=VIDEO_ID
    // https://youtu.be/VIDEO_ID
    // https://youtube.com/watch?v=VIDEO_ID
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return `https://www.youtube.com/embed/${match[1]}?autoplay=1&cc_load_policy=0`;
      }
    }
    
    return null;
  };

  // Query para obtener perfil (combinado de Firestore + PostgreSQL)
  const { data: userProfile, refetch: refetchProfile } = useCachedQuery({
    queryKey: ["userProfile", artistId],
    ttl: CACHE_TTL.default, // persiste 5 min en localStorage → pintado instantáneo en recargas
    queryFn: async () => {
      try {
        // SIEMPRE hacer fetch fresco desde PostgreSQL (fuente de verdad)
        let postgresData = null;
        try {
          const response = await fetch(`/api/profile/${artistId}`);
          if (response.ok) {
            postgresData = await response.json();
          }
        } catch (pgError) {
          logger.info("Artist not found in PostgreSQL by slug/id, trying Firestore");
        }
        
        // Buscar en Firestore usando el artistId (que puede ser el UID)
        // Intentar primero por uid, luego por el campo id personalizado
        const userDocByUid = await getDocs(query(collection(db, "users"), where("uid", "==", artistId)));
        let firestoreData = null;
        
        if (!userDocByUid.empty) {
          firestoreData = userDocByUid.docs[0].data();
          logger.info('? Found user in Firestore by uid:', artistId);
        } else {
          // Si no se encuentra por uid, intentar por el ID como string
          const userDocById = await getDocs(query(collection(db, "users"), where("id", "==", artistId)));
          if (!userDocById.empty) {
            firestoreData = userDocById.docs[0].data();
            logger.info('? Found user in Firestore by id field:', artistId);
          } else {
            logger.info('⚠️ User not found in Firestore for artistId:', artistId);
          }
        }
        
        // Combinar datos: PostgreSQL es la fuente de verdad para campos del perfil
        const combined = {
          ...firestoreData,
          ...(postgresData && {
            isAIGenerated: postgresData.isAIGenerated || false,
            firestoreId: postgresData.firestoreId,
            generatedBy: postgresData.generatedBy,
            slug: postgresData.slug,
            pgId: postgresData.id,
            clerkId: postgresData.clerkId,
            role: postgresData.role || firestoreData?.role || 'artist',
            biography: postgresData.biography || firestoreData?.biography,
            bannerPosition: postgresData.bannerPosition ?? firestoreData?.bannerPosition ?? "50",
            loopVideoUrl: postgresData.loopVideoUrl || firestoreData?.loopVideoUrl,
            location: postgresData.location || firestoreData?.location,
            email: postgresData.email || firestoreData?.email || firestoreData?.contactEmail,
            phone: postgresData.phone || firestoreData?.phone || firestoreData?.contactPhone,
            // ?? Social/streaming widgets: Postgres is the source of truth.
            // The EditProfileDialog writes to Postgres first; we must NOT fall back to
            // a stale Firestore value when the user clears ("disconnects") a field,
            // otherwise the widget keeps rendering with the old URL.
            instagram: postgresData.instagramHandle ?? firestoreData?.instagram ?? '',
            twitter:   postgresData.twitterHandle   ?? firestoreData?.twitter   ?? '',
            youtube:   postgresData.youtubeChannel  ?? firestoreData?.youtube   ?? '',
            spotify:   postgresData.spotifyUrl      ?? firestoreData?.spotify   ?? '',
            profileLayout: postgresData.profileLayout || null,
            // ? Im�genes de PostgreSQL
            profileImage: postgresData.profileImage || firestoreData?.profileImage || firestoreData?.photoURL,
            bannerImage: postgresData.coverImage || firestoreData?.bannerImage,
            photoURL: postgresData.profileImage || firestoreData?.photoURL,
            displayName: postgresData.artistName?.trim() || firestoreData?.displayName || firestoreData?.name,
            name: postgresData.artistName?.trim() || firestoreData?.name || firestoreData?.displayName,
            genre: postgresData.genres?.[0] || firestoreData?.genre,
            // ? Guardar datos de PostgreSQL para fallback
            pgSongs: postgresData.songs || [],
            pgVideos: postgresData.videos || [],
            pgMerch: postgresData.merchandise || []
          })
        };
        return combined;
      } catch (error) {
        logger.error("Error fetching user profile:", error);
        return null;
      }
    },
    enabled: !!artistId,
    // Optimizaci�n memoria/red Render: refresca m�x cada 60s y retiene 5 min
  });

  // Query para canciones
  const { data: songs = [] as Song[], refetch: refetchSongs } = useCachedQuery<Song[]>({
    queryKey: ["songs", userProfile?.firestoreId || artistId],
    ttl: CACHE_TTL.media, // persiste 10 min → evita re-leer Firestore en cada visita
    queryFn: async () => {
      try {
        // Buscar canciones por artistId (Firestore ID del artista)
        const firestoreArtistId = String(userProfile?.firestoreId || artistId);
        logger.info(`?? Fetching songs for artist Firestore ID: ${firestoreArtistId}`);
        
        const songsRef = collection(db, "songs");
        let allSongs: any[] = [];
        
        // Buscar por artistId (Firestore ID) - PRINCIPAL
        try {
          const q1 = query(songsRef, where("artistId", "==", firestoreArtistId));
          const snap1 = await getDocs(q1);
          allSongs = [...snap1.docs.map(doc => ({ id: doc.id, ...doc.data() }))];
          logger.info(`?? Found ${snap1.size} songs by artistId (Firestore ID): ${firestoreArtistId}`);
        } catch (e) {
          logger.warn('⚠️ Error searching by artistId:', e);
        }
        
        // FALLBACK: Si no se encontraron por artistId, intentar por userId con postgresId
        if (allSongs.length === 0 && userProfile?.pgId) {
          const pgIdStr = String(userProfile.pgId);
          const pgIdNum = Number(userProfile.pgId);
          logger.info(`?? Fallback: Searching by userId (postgresId): ${pgIdStr}`);
          
          try {
            const q2 = query(songsRef, where("userId", "==", pgIdStr));
            const snap2 = await getDocs(q2);
            allSongs = [...snap2.docs.map(doc => ({ id: doc.id, ...doc.data() }))];
            logger.info(`?? Found ${snap2.size} songs by userId (string): ${pgIdStr}`);
          } catch (e) {
            logger.warn('⚠️ Error searching by userId (string):', e);
          }
          
          // Tambi�n intentar como n�mero
          if (allSongs.length === 0 && !isNaN(pgIdNum)) {
            try {
              const q3 = query(songsRef, where("userId", "==", pgIdNum));
              const snap3 = await getDocs(q3);
              allSongs = [...snap3.docs.map(doc => ({ id: doc.id, ...doc.data() }))];
              logger.info(`?? Found ${snap3.size} songs by userId (number): ${pgIdNum}`);
            } catch (e) {
              logger.warn('⚠️ Error searching by userId (number):', e);
            }
          }
        }

        // RECOVERY: legacy uploads stored userId === firestoreArtistId and
        // omitted artistId. Pick those up too so existing songs stay visible.
        if (allSongs.length === 0) {
          try {
            const qLegacy = query(songsRef, where("userId", "==", firestoreArtistId));
            const snapLegacy = await getDocs(qLegacy);
            allSongs = [...snapLegacy.docs.map(doc => ({ id: doc.id, ...doc.data() }))];
            logger.info('Found legacy songs by userId === firestoreArtistId: ' + snapLegacy.size);
          } catch (e) {
            logger.warn('Error searching by legacy userId path:', e);
          }
        }
        const querySnapshot = allSongs;
        logger.info(`?? Songs query returned ${querySnapshot.length} documents total`);

        if (querySnapshot.length === 0) {
          logger.info('⚠️ No songs found in Firestore for this artist, checking PostgreSQL fallback...');
          
          // ? FALLBACK POSTGRESQL: Usar canciones de PostgreSQL si existen
          if (userProfile?.pgSongs && userProfile.pgSongs.length > 0) {
            logger.info(`? Found ${userProfile.pgSongs.length} songs from PostgreSQL (fallback)`);
            const pgSongsData = userProfile.pgSongs.map((song: any) => ({
              id: String(song.id),
              name: song.title || song.name,
              title: song.title || song.name,
              plays: Number(song.plays || 0),
              audioUrl: song.audioUrl || song.audio_url || '',
              duration: song.duration || '3:45',
              userId: String(song.userId || song.user_id),
              createdAt: song.createdAt ? new Date(song.createdAt) : undefined,
              storageRef: song.storageRef || song.storage_ref,
              coverArt: song.coverArt || song.cover_art || '/assets/freepik__boostify_music_organe_abstract_icon.png',
              isSingle: !!(song.isSingle ?? song.is_single),
              singlePinnedAt: song.singlePinnedAt || song.single_pinned_at,
              displayOrder: typeof (song.displayOrder ?? song.display_order) === 'number' ? (song.displayOrder ?? song.display_order) : undefined,
              genre: song.genre,
              description: song.description,
              isrc: song.isrc,
              upc: song.upc,
              composers: song.composers,
              lyrics: song.lyrics
            }));
            return pgSongsData;
          }
          
          return [];
        }

        const songsData = querySnapshot.map((doc: any) => {
          const data = typeof doc.data === 'function' ? doc.data() : doc;
          const docId = doc.id || doc.id;
          const normalizedTitle = String(data.name || data.title || '').trim().toLowerCase();
          const matchedPgSong = Array.isArray(userProfile?.pgSongs)
            ? userProfile.pgSongs.find((song: any) => String(song.title || song.name || '').trim().toLowerCase() === normalizedTitle)
            : undefined;
          logger.info('?? Song data:', { id: docId, name: data.name, audioUrl: data.audioUrl });
          return {
            id: docId,
            name: data.name,
            title: data.name || data.title,
            plays: Number(data.plays ?? matchedPgSong?.plays ?? 0),
            audioUrl: data.audioUrl,
            duration: data.duration || "3:45",
            userId: data.userId,
            createdAt: toDateValue(data.createdAt),
            storageRef: data.storageRef,
            coverArt: data.coverArt || '/assets/freepik__boostify_music_organe_abstract_icon.png',
            isSingle: !!(data.isSingle ?? data.is_single),
            singlePinnedAt: data.singlePinnedAt || data.single_pinned_at,
            displayOrder: typeof data.displayOrder === 'number' ? data.displayOrder : undefined,
            genre: data.genre,
            isrc: data.isrc,
            upc: data.upc,
            composers: data.composers,
            lyrics: data.lyrics,
          };
        });
        
        logger.info(`? Successfully loaded ${songsData.length} songs`);
        return songsData;
      } catch (error) {
        logger.error("? Error fetching songs:", error);
        return [];
      }
    },
    enabled: !!artistId
  });

  // ── Fan monetization: catalog access state ───────────────────────────────
  // Resolve the artist's integer Postgres id (used by the access/unlock API).
  const artistPgIdForAccess = (() => {
    const p = Number(userProfile?.pgId);
    if (Number.isInteger(p) && p > 0) return p;
    const fromSong = Number(songs?.find((s) => s.userId)?.userId);
    return Number.isInteger(fromSong) && fromSong > 0 ? fromSong : 0;
  })();

  const analyticsArtistKey = userProfile?.pgId || userProfile?.slug || artistId;
  const { data: analyticsSummary } = useCachedQuery<{
    songCount: number;
    totalPlays: number;
    videoCount: number;
    totalViews: number;
    catalogProductCount: number;
    unitsSold: number;
    totalRevenue: number;
    merchUnitsSold: number;
    smartMerchUnitsSold: number;
    smartMerchProductCount: number;
  } | null>({
    queryKey: ["artist-analytics-summary", analyticsArtistKey],
    ttl: CACHE_TTL.stats, // stats agregadas: cache corto (2 min) + pintado instantáneo
    queryFn: async () => {
      const res = await fetch(`/api/profile/${analyticsArtistKey}/analytics-summary`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!analyticsArtistKey,
  });

  const fanEmailStorageKey = artistPgIdForAccess > 0
    ? `boostify:artist-fan-email:${artistPgIdForAccess}`
    : null;

  useEffect(() => {
    if (!fanEmailStorageKey) return;
    const savedEmail = window.localStorage.getItem(fanEmailStorageKey);
    if (savedEmail) setGuestFanEmail(savedEmail);
  }, [fanEmailStorageKey]);

  const { data: accessData, refetch: refetchAccess } = useQuery({
    queryKey: ["artist-access", artistPgIdForAccess, user?.id, guestFanEmail],
    queryFn: async () => {
      if (!artistPgIdForAccess) {
        return { hasAccess: false, unlimited: false, unlocked: false, previewSeconds: 30 };
      }
      try {
        const q = !isAuthenticated && guestFanEmail
          ? `?fanEmail=${encodeURIComponent(guestFanEmail.trim().toLowerCase())}`
          : "";
        return await apiRequest({ url: `/api/artist/${artistPgIdForAccess}/access${q}`, method: "GET" });
      } catch {
        return { hasAccess: false, unlimited: false, unlocked: false, previewSeconds: 30 };
      }
    },
    enabled: !!artistPgIdForAccess,
    staleTime: 60_000,
  });

  const hasFullAccess = !!(accessData?.unlimited || accessData?.unlocked);
  const previewSeconds = Number(accessData?.previewSeconds) || 30;

  // The single free song (first track flagged isSingle, respecting displayOrder).
  // Fallback: if the artist hasn't pinned a single, the first track becomes the
  // free fully-playable song, so there is always at least one song visitors can
  // listen to in full (the rest stay capped at the 30s preview).
  const freeSingleId = (() => {
    if (!songs || songs.length === 0) return null;
    const ordered = [...songs].sort((a, b) => {
      const ao = typeof (a as any).displayOrder === "number" ? (a as any).displayOrder : 9999;
      const bo = typeof (b as any).displayOrder === "number" ? (b as any).displayOrder : 9999;
      return ao - bo;
    });
    const single = ordered.find((s) => s.isSingle);
    if (single) return String(single.id);
    return ordered[0] ? String(ordered[0].id) : null;
  })();

  // A song is locked (30s preview only) when the viewer lacks full access and
  // it isn't the free single.
  const isSongLocked = useCallback(
    (song: Song): boolean => {
      if (hasFullAccess) return false;
      if (freeSingleId && String(song.id) === freeSingleId) return false;
      return true;
    },
    [hasFullAccess, freeSingleId],
  );

  // When a free preview hits its 30s cap, prompt the visitor to unlock.
  useEffect(() => {
    const onPreviewEnded = () => {
      if (hasFullAccess) return;
      setUnlockModalOpen(true);
    };
    window.addEventListener("boostify:preview-ended", onPreviewEnded as EventListener);
    return () =>
      window.removeEventListener("boostify:preview-ended", onPreviewEnded as EventListener);
  }, [hasFullAccess]);

  // Handle the Stripe redirect back (?unlock=success|cancelled).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const unlock = params.get("unlock");
    if (!unlock) return;
    if (unlock === "success") {
      const plan = params.get("plan");
      refetchAccess?.();
      setUnlockModalOpen(false);
      toast({
        title: plan === "monthly" ? "Monthly membership active!" : "Catalog unlocked!",
        description:
          plan === "monthly"
            ? "You now have monthly full-catalog access for this artist."
            : "Thanks for supporting this artist. You now have full lifetime access to all songs.",
      });
    }
    params.delete("unlock");
    params.delete("plan");
    const rest = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (rest ? `?${rest}` : ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start (or resume) a pay-what-you-want unlock checkout.
  const handleUnlockCheckout = async () => {
    const emailForGuest = guestFanEmail.trim().toLowerCase();
    if (!isAuthenticated) {
      const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailForGuest);
      if (!isEmailValid) {
        toast({
          title: "Enter a valid email",
          description: "We need your email to create your fan access for this artist.",
          variant: "destructive",
        });
        return;
      }
    }
    const cents = Math.round(Number(unlockAmount) * 100);
    if (!Number.isFinite(cents) || cents < 500) {
      toast({ title: "Minimum is $5", description: "Your contribution must be at least $5.", variant: "destructive" });
      return;
    }
    if (!artistPgIdForAccess) {
      toast({ title: "Error", description: "Could not identify the artist.", variant: "destructive" });
      return;
    }
    try {
      setUnlockLoading(true);
      const returnPath = window.location.pathname + window.location.search;
      if (!isAuthenticated && fanEmailStorageKey) {
        window.localStorage.setItem(fanEmailStorageKey, emailForGuest);
      }
      const r: any = await apiRequest({
        url: `/api/artist/${artistPgIdForAccess}/unlock-checkout`,
        method: "POST",
        data: {
          amount: cents,
          returnPath,
          fanEmail: !isAuthenticated ? emailForGuest : undefined,
          fanName: !isAuthenticated ? guestFanName.trim() || undefined : undefined,
        },
      });
      if (r?.url) {
        window.location.href = r.url;
        return;
      }
      throw new Error(r?.error || "Could not start checkout");
    } catch (e: any) {
      refetchAccess?.();
      toast({
        title: "Could not start checkout",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUnlockLoading(false);
    }
  };

  // Start monthly artist-catalog subscription checkout ($20/mo).
  const handleMonthlySubscriptionCheckout = async () => {
    if (!isAuthenticated) {
      toast({
        title: "Login required",
        description: "Monthly membership is linked to your account so your access syncs automatically.",
        variant: "destructive",
      });
      return;
    }
    if (!artistPgIdForAccess) {
      toast({ title: "Error", description: "Could not identify the artist.", variant: "destructive" });
      return;
    }

    try {
      setUnlockLoading(true);
      const returnPath = window.location.pathname + window.location.search;
      const r: any = await apiRequest({
        url: `/api/artist/${artistPgIdForAccess}/subscription-checkout`,
        method: "POST",
        data: { returnPath },
      });
      if (r?.url) {
        window.location.href = r.url;
        return;
      }
      throw new Error(r?.error || "Could not start subscription checkout");
    } catch (e: any) {
      refetchAccess?.();
      toast({
        title: "Could not start subscription",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setUnlockLoading(false);
    }
  };

  // Module access in Artist Profile: ADMIN only bypasses everything.
  // Non-admin users need a one-time module unlock (or all-access pass).
  const hasProfileModuleAccess = useCallback((sectionId: string): boolean => {
    const moduleKey = profileSectionToModuleKey[sectionId];
    if (!moduleKey) return true;
    if (isModuleAdmin) return true;
    return profileAllAccess || profileUnlockedKeys.includes(moduleKey);
  }, [isModuleAdmin, profileAllAccess, profileUnlockedKeys]);

  const handleProfileModuleUnlockCheckout = useCallback(async (sectionId: string) => {
    const moduleKey = profileSectionToModuleKey[sectionId];
    const moduleDef = moduleKey ? getModule(moduleKey) : null;
    if (!moduleKey || !moduleDef) {
      toast({
        title: "Módulo no disponible",
        description: "No se encontró configuración de precio para este módulo.",
        variant: "destructive",
      });
      return;
    }
    if (!isAuthenticated) {
      toast({
        title: "Inicia sesión",
        description: "Necesitas una cuenta para desbloquear este módulo.",
        variant: "destructive",
      });
      return;
    }

    try {
      setProfileModuleCheckoutLoading(sectionId);
      const returnPath = window.location.pathname + window.location.search;
      const r: any = await apiRequest({
        url: `/api/modules/${moduleKey}/unlock-checkout`,
        method: "POST",
        data: { returnPath },
      });
      if (r?.url) {
        window.location.href = r.url;
        return;
      }
      throw new Error(r?.error || "No se pudo iniciar el pago");
    } catch (e: any) {
      if (e?.message?.toLowerCase?.().includes('already')) {
        refetchModuleAccess?.();
        return;
      }
      toast({
        title: "No se pudo iniciar el pago",
        description: e?.message || "Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setProfileModuleCheckoutLoading(null);
    }
  }, [isAuthenticated, refetchModuleAccess, toast]);

  // Handle Stripe redirect for profile module unlocks (?unlocked=<moduleKey>).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const unlocked = params.get("unlocked");
    if (!unlocked) return;

    refetchModuleAccess?.();
    const mod = getModule(unlocked);
    if (mod) {
      toast({
        title: "¡Módulo desbloqueado! 🎉",
        description: `Ya puedes usar ${mod.name} en tu Artist Profile.`,
      });
    }

    params.delete("unlocked");
    const rest = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (rest ? `?${rest}` : ""));
  }, [refetchModuleAccess, toast]);

  // Auto-play the artist's pinned single (or first song) when the profile
  // opens. Starts MUTED (browsers block unmuted autoplay) and stays in the
  // global MiniPlayer so the visitor can unmute or close it easily.
  useEffect(() => {
    if (autoplayBootstrapped) return;
    if (!songs || songs.length === 0) return;
    if (audioPlayer.currentTrack) return; // something already loaded
    if (typeof getAutoplayPreference === "function" && !getAutoplayPreference()) {
      setAutoplayBootstrapped(true);
      return;
    }
    const playable = songs.filter(
      (s) => s.audioUrl && !String(s.audioUrl).startsWith("ipfs://"),
    );
    if (playable.length === 0) {
      setAutoplayBootstrapped(true);
      return;
    }
    const ordered = sortSongsSinglesFirst(playable);
    // Try unmuted autoplay first. If the browser blocks it (no user gesture),
    // we transparently retry muted so the song still loads � the user can then
    // click anywhere to unmute. The previous behavior was muted-by-default,
    // which left audio off even after the user clicked Play.
    audioPlayer.playQueue(ordered.map(songToTrack), {
      startIndex: 0,
      autoplay: true,
      muted: false,
    });
    setAutoplayBootstrapped(true);

    // Browsers block unmuted autoplay without a prior user gesture.
    // Register a one-shot listener: the moment the visitor touches or
    // clicks anything we force-unmute the audio element so playback
    // starts with sound automatically on first interaction.
    const unmuteOnInteraction = () => {
      // setMuted(false) always writes audioRef.muted = false even when
      // React state already shows isMuted=false (stale after browser
      // silently forced muted), so this reliably unblocks the audio.
      audioPlayer.setMuted(false);
    };
    document.addEventListener('touchend', unmuteOnInteraction, { once: true, capture: true });
    document.addEventListener('click',    unmuteOnInteraction, { once: true, capture: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songs?.length]);

  // Query para videos
  const { data: videos = [] as Video[], refetch: refetchVideos } = useCachedQuery<Video[]>({
    queryKey: ["videos", userProfile?.pgId || userProfile?.uid || userProfile?.clerkId || artistId],
    ttl: CACHE_TTL.media, // persiste 10 min → evita re-leer Firestore en cada visita
    queryFn: async () => {
      try {
        const pgId = userProfile?.pgId || artistId;
        const pgIdNum = Number(pgId);
        const pgIdStr = String(pgId);
        const firebaseUid = userProfile?.uid || artistId;
        const clerkId = (userProfile as any)?.clerkId;
        logger.info(`?? Fetching videos: pgId=${pgId}, firebaseUid=${firebaseUid}, clerkId=${clerkId}`);
        
        const videosRef = collection(db, "videos");
        let allVideos: any[] = [];
        const seenIds = new Set<string>();
        const mergeResults = (docs: any[]) => {
          for (const doc of docs) {
            if (!seenIds.has(doc.id)) {
              seenIds.add(doc.id);
              allVideos.push(doc);
            }
          }
        };
        
        // 0. Buscar por artistId � igual que hace la query de canciones
        // primaryFsId: firestoreId ? slug (mismo orden que useProfileLayout)
        const firestoreArtistId = String(userProfile?.firestoreId || artistId);
        const artistSlugFallback = (userProfile as any)?.slug || '';
        const primaryFsIds = new Set<string>([
          firestoreArtistId,
          ...(artistSlugFallback ? [artistSlugFallback] : []),
        ]);
        for (const fsId of primaryFsIds) {
          try {
            const q0 = query(videosRef, where("artistId", "==", fsId));
            const snap0 = await getDocs(q0);
            mergeResults(snap0.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            logger.info(`?? Found ${snap0.size} videos by artistId: ${fsId}`);
          } catch (e) {
            logger.warn('?? Error searching videos by artistId:', e);
          }
        }

        // 1. Buscar por pgId num�rico (artistas AI generados)
        if (!isNaN(pgIdNum) && pgIdNum > 0) {
          try {
            const q1 = query(videosRef, where("userId", "==", pgIdNum));
            const snap1 = await getDocs(q1);
            mergeResults(snap1.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            logger.info(`?? Found ${snap1.size} videos by pgId (number): ${pgIdNum}`);
          } catch (e) {
            logger.warn('?? Error searching videos by pgId (number):', e);
          }
        }

        // 2. Buscar por pgId como string
        try {
          const q2 = query(videosRef, where("userId", "==", pgIdStr));
          const snap2 = await getDocs(q2);
          mergeResults(snap2.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          logger.info(`?? Found ${snap2.size} videos by pgId (string): ${pgIdStr}`);
        } catch (e) {
          logger.warn('?? Error searching videos by pgId (string):', e);
        }

        // 3. Buscar por Clerk UID (usuarios reales autenticados con Clerk)
        if (clerkId && clerkId !== pgIdStr) {
          try {
            const q3 = query(videosRef, where("userId", "==", clerkId));
            const snap3 = await getDocs(q3);
            mergeResults(snap3.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            logger.info(`?? Found ${snap3.size} videos by clerkId: ${clerkId}`);
          } catch (e) {
            logger.warn('?? Error searching videos by clerkId:', e);
          }
        }

        // 4. Buscar por Firebase UID si es distinto
        if (firebaseUid && firebaseUid !== pgIdStr && firebaseUid !== clerkId) {
          try {
            const q4 = query(videosRef, where("userId", "==", firebaseUid));
            const snap4 = await getDocs(q4);
            mergeResults(snap4.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            logger.info(`?? Found ${snap4.size} videos by Firebase UID: ${firebaseUid}`);
          } catch (e) {
            logger.warn('?? Error searching videos by Firebase UID:', e);
          }
        }

        // 5. Buscar por slug del artista como userId (legacy)
        if (artistSlugFallback && artistSlugFallback !== pgIdStr && artistSlugFallback !== firestoreArtistId) {
          try {
            const q5 = query(videosRef, where("userId", "==", artistSlugFallback));
            const snap5 = await getDocs(q5);
            mergeResults(snap5.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            logger.info(`?? Found ${snap5.size} videos by slug: ${artistSlugFallback}`);
          } catch (e) {
            logger.warn('?? Error searching videos by slug:', e);
          }
        }
        
        const querySnapshot = allVideos;
        logger.info(`?? Videos query returned ${querySnapshot.length} documents total`);

        if (querySnapshot.length === 0) {
          logger.info('No videos found in Firestore, checking PostgreSQL fallback...');
          
          // FALLBACK POSTGRESQL: Usar videos de PostgreSQL si existen
          if (userProfile?.pgVideos && userProfile.pgVideos.length > 0) {
            const pgVideosData = userProfile.pgVideos.map((video: any) => ({
              id: String(video.id),
              title: video.title || 'Untitled',
              url: video.storagePath || video.storage_path || '',
              userId: String(video.userId || video.user_id),
              thumbnailUrl: video.thumbnail || null,
              createdAt: video.createdAt ? new Date(video.createdAt) : undefined,
              views: video.views || 0,
              likes: 0,
              type: video.type || 'video',
              storagePath: video.storagePath || video.storage_path || '',
              downloadPassword: video.downloadPassword || video.download_password,
              fileFormat: video.fileFormat || video.file_format,
              fileSize: video.fileSize || video.file_size,
              description: video.description,
            }));
            return pgVideosData;
          }
          
          return [];
        }

        const videosData = querySnapshot.map((doc: any) => {
          const data = typeof doc.data === 'function' ? doc.data() : doc;
          const docId = doc.id || doc.id;
          
          // Solo extraer videoId si es una URL de YouTube
          const isYouTubeUrl = data.url?.includes('youtube.com') || data.url?.includes('youtu.be');
          let videoId = null;
          let thumbnailUrl = data.thumbnailUrl;
          
          if (isYouTubeUrl) {
            videoId = data.url?.split('v=')?.[1]?.split('&')[0] || data.url?.split('/')?.[3]?.split('?')?.[0];
            // Solo generar thumbnail de YouTube si no hay uno ya guardado y si tenemos un videoId v�lido
            if (!thumbnailUrl && videoId && videoId !== 'shorts') {
              thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
            }
          }
          
          logger.info('?? Video data:', { 
            id: docId, 
            title: data.title, 
            url: data.url,
            isYouTube: isYouTubeUrl,
            hasStoredThumbnail: !!data.thumbnailUrl
          });
          
          return {
            id: docId,
            title: data.title,
            url: data.url,
            userId: data.userId || artistId,
            thumbnailUrl: thumbnailUrl,
            createdAt: toDateValue(data.createdAt),
            views: Number(data.views || 0),
            likes: Number(data.likes || 0),
            type: data.type,
            storagePath: data.storagePath,
            downloadPassword: data.downloadPassword,
            fileFormat: data.fileFormat,
            fileSize: data.fileSize,
            scriptPdfUrl: data.scriptPdfUrl,
            scriptPdfPath: data.scriptPdfPath,
          };
        });
        
        logger.info(`? Successfully loaded ${videosData.length} videos`);
        return videosData;
      } catch (error) {
        logger.error("❌ Error fetching videos:", error);
        return [];
      }
    },
    enabled: !!artistId
  });

  // Query para Music Video Projects con video renderizado
  interface MusicVideoProject {
    id: number;
    artistName: string;
    songName: string;
    finalVideoUrl?: string;
    thumbnail?: string;
    status: string;
    createdAt: string;
  }
  
  const { data: musicVideoProjects = [] as MusicVideoProject[] } = useQuery<MusicVideoProject[]>({
    queryKey: ["musicVideoProjects", userProfile?.slug || artistId],
    queryFn: async () => {
      try {
        const slug = userProfile?.slug || artistId;
        logger.info(`?? Fetching music video projects for artist: ${slug}`);
        
        // Buscar proyectos completados por slug del artista
        const response = await fetch(`/api/music-video-projects/by-artist/${slug}`);
        
        if (!response.ok) {
          logger.warn(`⚠️ No music video projects found for ${slug}`);
          return [];
        }
        
        const data = await response.json();
        
        if (data.success && Array.isArray(data.projects)) {
          // Filtrar solo los que tienen video final
          const completedProjects = data.projects.filter(
            (p: any) => p.finalVideoUrl && p.status === 'completed'
          );
          logger.info(`? Found ${completedProjects.length} completed music videos`);
          return completedProjects;
        }
        
        return [];
      } catch (error) {
        logger.error("❌ Error fetching music video projects:", error);
        return [];
      }
    },
    enabled: !!artistId
  });

  // Query para productos con auto-generaci�n
  const { data: products = [] as Product[], refetch: refetchProducts } = useQuery<Product[]>({
    queryKey: ["merchandise", userProfile?.pgId, artistId],
    queryFn: async () => {
      try {
        // Usar pgId si est� disponible, sino artistId (que puede ser slug)
        const pgId = userProfile?.pgId;
        const slug = userProfile?.slug || artistId;
        
        logger.info(`🛍️ Fetching merchandise for artist:`, { pgId, slug, artistId });
        
        const merchRef = collection(db, "merchandise");
        let allProducts: any[] = [];
        
        // Buscar por m�ltiples identificadores para encontrar todos los productos
        // 1. Buscar por pgId (n�mero)
        if (pgId) {
          const q1 = query(merchRef, where("userId", "==", pgId));
          const snap1 = await getDocs(q1);
          snap1.docs.forEach(doc => {
            if (!allProducts.find(p => p.id === doc.id)) {
              allProducts.push({ id: doc.id, ...doc.data() });
            }
          });
          logger.info(`?? Found ${snap1.size} products by pgId: ${pgId}`);
          
          // Tambi�n buscar por pgId como string
          const q1b = query(merchRef, where("userId", "==", String(pgId)));
          const snap1b = await getDocs(q1b);
          snap1b.docs.forEach(doc => {
            if (!allProducts.find(p => p.id === doc.id)) {
              allProducts.push({ id: doc.id, ...doc.data() });
            }
          });
          if (snap1b.size > 0) {
            logger.info(`?? Found ${snap1b.size} additional products by pgId as string`);
          }
        }
        
        // 2. Buscar por slug (string)
        if (slug && slug !== String(pgId)) {
          const q2 = query(merchRef, where("userId", "==", slug));
          const snap2 = await getDocs(q2);
          snap2.docs.forEach(doc => {
            if (!allProducts.find(p => p.id === doc.id)) {
              allProducts.push({ id: doc.id, ...doc.data() });
            }
          });
          if (snap2.size > 0) {
            logger.info(`?? Found ${snap2.size} products by slug: ${slug}`);
          }
        }
        
        // 3. Buscar por artistId original si es diferente
        if (artistId !== slug && artistId !== String(pgId)) {
          const q3 = query(merchRef, where("userId", "==", artistId));
          const snap3 = await getDocs(q3);
          snap3.docs.forEach(doc => {
            if (!allProducts.find(p => p.id === doc.id)) {
              allProducts.push({ id: doc.id, ...doc.data() });
            }
          });
          if (snap3.size > 0) {
            logger.info(`?? Found ${snap3.size} products by artistId: ${artistId}`);
          }
        }
        
        // 4. Si no encontramos nada, buscar en generated_artists (productos generados por IA)
        if (allProducts.length === 0) {
          logger.info(`🔍 No products in merchandise collection, checking generated_artists...`);
          
          // Buscar el documento del artista en generated_artists usando firestoreId
          const firestoreId = userProfile?.firestoreId;
          if (firestoreId) {
            try {
              // Usar getDoc para obtener el documento directamente por ID
              const genArtistDocRef = doc(db, "generated_artists", firestoreId);
              const genArtistSnap = await getDoc(genArtistDocRef);
              
              if (genArtistSnap.exists()) {
                const artistData = genArtistSnap.data();
                if (artistData.merchandise && Array.isArray(artistData.merchandise)) {
                  logger.info(`?? Found ${artistData.merchandise.length} products in generated_artists`);
                  
                  // Migrar productos a la colecci�n merchandise y agregarlos a allProducts
                  for (const product of artistData.merchandise) {
                    const merchDoc = {
                      name: product.name,
                      description: `Official ${artistData.name || userProfile?.name} merchandise - ${product.type}`,
                      price: product.price,
                      imageUrl: product.imageUrl,
                      category: product.type === 'T-Shirt' || product.type === 'Hoodie' ? 'Apparel' :
                                product.type === 'Cap' || product.type === 'Sticker Pack' || product.type === 'Mug' ? 'Accessories' :
                                product.type === 'Poster' ? 'Art' : 'Accessories',
                      sizes: product.type === 'T-Shirt' || product.type === 'Hoodie' ? ['S', 'M', 'L', 'XL', 'XXL'] :
                             product.type === 'Cap' ? ['One Size'] :
                             product.type === 'Poster' ? ['18x24"', '24x36"'] :
                             product.type === 'Mug' ? ['11oz', '15oz'] : ['Standard'],
                      userId: pgId || artistId,
                      createdAt: new Date(),
                      generatedByAI: true
                    };
                    
                    // Guardar en colecci�n merchandise para futuras consultas
                    const newDocRef = doc(collection(db, "merchandise"));
                    await setDoc(newDocRef, merchDoc);
                    allProducts.push({ id: newDocRef.id, ...merchDoc });
                    logger.info(`? Migrated product: ${product.name}`);
                  }
                  
                  logger.info(`? Migrated ${allProducts.length} products from generated_artists to merchandise`);
                }
              } else {
                logger.info(`⚠️ No generated_artists document found for firestoreId: ${firestoreId}`);
              }
            } catch (error) {
              logger.error('Error checking generated_artists:', error);
            }
          }
        }
        
        logger.info(`?? Total unique products found: ${allProducts.length}`);
        
        // Log todos los productos encontrados
        if (allProducts.length > 0) {
          logger.info(`?? Products found in Firestore:`);
          allProducts.forEach((product) => {
            logger.info(`  - Product ID: ${product.id}`, {
              name: product.name,
              userId: product.userId,
              hasImage: !!product.imageUrl,
              imageUrl: product.imageUrl?.substring(0, 80) + '...'
            });
          });
        } else {
          logger.info(`⚠️ No products found for artist`);
        }

        if (allProducts.length > 0) {
          // ?? LIMPIEZA: Eliminar productos duplicados y con im�genes incorrectas
          // Productos v�lidos tienen im�genes en 'merchandise-images/' no en 'artist-images/'
          const validProducts: typeof allProducts = [];
          const seenTypes = new Set<string>();
          const productsToDelete: string[] = [];

          const canonicalType = (product: any): string => {
            const raw = String(product?.productType || product?.type || product?.category || product?.name || '').toLowerCase();
            if (raw.includes('t-shirt') || raw.includes('t shirt') || raw.includes('tee')) return 't-shirt';
            if (raw.includes('hoodie')) return 'hoodie';
            if (raw.includes('cap') || raw.includes('hat') || raw.includes('snapback')) return 'cap';
            if (raw.includes('poster') || raw.includes('print')) return 'poster';
            if (raw.includes('sticker')) return 'sticker-pack';
            if (raw.includes('mug') || raw.includes('cup')) return 'mug';
            return raw || 'unknown';
          };
          
          for (const product of allProducts) {
            const productType = canonicalType(product);
            // Accept any image URL that isn't an artist profile photo
            // (FAL, FHDR, Firebase Storage non-profile paths, etc. are all valid)
            const isArtistProfileImage = product.imageUrl?.includes('artist-images/');
            const hasValidMerchImage = !!(product.imageUrl) && !isArtistProfileImage;
            
            // Keep products with valid images (1 per type to avoid duplicates)
            if (!seenTypes.has(productType) && hasValidMerchImage) {
              seenTypes.add(productType);
              validProducts.push(product);
            } else {
              // Mark duplicates for cleanup only
              productsToDelete.push(product.id);
            }
          }
          
          // Si hay productos inv�lidos, eliminarlos
          if (productsToDelete.length > 0 && validProducts.length >= 6) {
            logger.info(`🗑️ Cleaning up ${productsToDelete.length} invalid/duplicate products...`);
            // Eliminar en batches para no sobrecargar
            const batchSize = 10;
            for (let i = 0; i < productsToDelete.length; i += batchSize) {
              const batch = productsToDelete.slice(i, i + batchSize);
              await Promise.all(batch.map(id => deleteDoc(doc(db, "merchandise", id)).catch(() => {})));
            }
            logger.info(`? Cleaned up products, keeping ${validProducts.length} valid ones`);
            allProducts = validProducts;
          } else if (validProducts.length === 0 && allProducts.length > 6) {
            // All products have invalid images � skip (no auto-deletion, user can regenerate manually)
            logger.info('Info: All products have invalid images, skipping (user can regenerate via AI Design button)');
          }
          
          // Verificar si los productos existentes tienen tallas (productos nuevos)
          const firstProduct = allProducts[0];
          const hasNewFormat = firstProduct?.sizes !== undefined;
          
          if (allProducts.length > 0 && hasNewFormat) {
            // Cargar productos actualizados con tallas - limitar a 6 productos
            const productsData = allProducts.slice(0, 6).map((product) => {
              logger.info('🛍️ Product data:', { id: product.id, name: product.name, price: product.price, sizes: product.sizes });
              return {
                id: product.id,
                name: product.name,
                description: product.description,
                price: product.price,
                imageUrl: product.imageUrl,
                category: product.category,
                sizes: product.sizes,
                userId: product.userId,
                createdAt: product.createdAt?.toDate ? product.createdAt.toDate() : product.createdAt,
              };
            });
            logger.info(`? Successfully loaded ${productsData.length} existing products with sizes`);
            return productsData;
          } else if (allProducts.length > 0 && !hasNewFormat) {
            // Old products without sizes � return them as-is (no auto-deletion)
            logger.info('Info: Products found without sizes � returning as-is');
            return allProducts.slice(0, 6).map((product: any) => ({
              id: product.id,
              name: product.name,
              description: product.description,
              price: product.price,
              imageUrl: product.imageUrl,
              category: product.category,
              sizes: product.sizes,
              userId: product.userId,
              createdAt: product.createdAt?.toDate ? product.createdAt.toDate() : product.createdAt,
            }));
          }
        }

        // No products found � return empty array.
        // Use the 'AI Design' button in the Official Store section to generate products manually.
        return [];
      } catch (error) {
        logger.error("❌ Error fetching/creating merchandise:", error);
        return [];
      }
    },
    enabled: !!artistId
  });

  // Query para verificar si el artista tiene contrato de colaboraci�n de merch
  const { data: merchContractData, refetch: refetchMerchContract } = useQuery({
    queryKey: ["merch-contract", userProfile?.pgId],
    queryFn: async () => {
      const pgId = userProfile?.pgId;
      if (!pgId) return { hasContract: false, contract: null };
      const res = await fetch(`/api/merch-contract/status/${pgId}`);
      if (!res.ok) return { hasContract: false, contract: null };
      const data = await res.json();
      return data.data || { hasContract: false, contract: null };
    },
    enabled: !!userProfile?.pgId
  });

  // Log cuando products cambie
  useEffect(() => {
    logger.info(`🛍️ Products state updated: ${products.length} products`);
    if (products.length > 0) {
      logger.info('? MERCHANDISE SECTION SHOULD BE VISIBLE');
    } else {
      logger.info('⚠️ MERCHANDISE SECTION IS HIDDEN (no products)');
    }
  }, [products]);

  // Query para verificar si este artista est� en my-artists del usuario actual
  // Este query se ejecuta independientemente de userProfile para ser m�s r�pido
  // Usamos user.id > 0 en lugar de !!user.id porque id puede ser 0 temporalmente
  const { data: isInMyArtists, isLoading: isCheckingMyArtists } = useQuery({
    queryKey: ["isInMyArtists", artistId, user?.id],
    queryFn: async () => {
      logger.info('🔍 Executing isInMyArtists query for artistId:', artistId);
      try {
        const response = await fetch('/api/artist-generator/my-artists');
        if (response.ok) {
          const data = await response.json();
          
          // Comparar usando TODOS los identificadores posibles
          // artistId puede ser: slug, firestoreId, o pgId num�rico
          const found = data.artists?.some((a: any) => {
            // Comparar por slug (URL)
            if (a.slug && a.slug === artistId) return true;
            // Comparar por firestoreId
            if (a.firestoreId && a.firestoreId === artistId) return true;
            // Comparar por id num�rico
            if (a.id && String(a.id) === String(artistId)) return true;
            return false;
          });
          
          logger.info('🔍 isInMyArtists check:', {
            artistIdFromUrl: artistId,
            myArtistsCount: data.artists?.length,
            myArtistsSlugs: data.artists?.map((a: any) => a.slug),
            found
          });
          
          return found === true;
        }
        logger.warn('⚠️ my-artists response not ok:', response.status);
        return false;
      } catch (error) {
        logger.error('Error checking isInMyArtists:', error);
        return false;
      }
    },
    // Habilitar cuando hay un usuario autenticado (user existe, incluso si id es 0)
    enabled: !!user && !!artistId,
    staleTime: 5000, // Cache por 5 segundos
  });

  // Verificar si es perfil propio: SIMPLE Y PERMISIVO
  // ? Permite editar si: es creador del artista O propietario directo O est� en my-artists
  // Mejorado para manejar el caso donde user.id puede ser 0 temporalmente
  const isOwnProfile = (() => {
    if (!user) return false;
    
    // ? PRIORIDAD 1: Si est� en my-artists del usuario, es SU perfil y puede editarlo
    // Esto funciona para artistas generados por IA
    if (isInMyArtists === true) {
      logger.info('? isOwnProfile=true porque isInMyArtists=true');
      return true;
    }
    
    // Si user.id es 0 pero tenemos clerkId, intentar comparar con clerkId
    const userId = user.id > 0 ? user.id : null;
    const userClerkId = (user as any).clerkId;
    
    // Comparaci�n por ID num�rico de PostgreSQL
    if (userId && userProfile?.pgId && Number(userId) === Number(userProfile.pgId)) {
      return true;
    }
    
    // Comparaci�n por generatedBy (artistas creados por este usuario)
    if (userId && userProfile?.generatedBy && Number(userProfile.generatedBy) === Number(userId)) {
      return true;
    }
    
    // Comparaci�n por clerkId (si el artista tiene el mismo clerkId)
    if (userClerkId && (userProfile as any)?.clerkId && userClerkId === (userProfile as any).clerkId) {
      return true;
    }
    
    // Comparaci�n por artistId en la URL vs userId
    if (userId && String(userId) === String(artistId)) {
      return true;
    }
    
    // Comparaci�n por firestoreId
    if (userClerkId && userProfile?.uid && userClerkId === userProfile.uid) {
      return true;
    }
    
    return false;
  })();
  
  // Debug logging para verificar autenticaci�n
  useEffect(() => {
    logger.info('🔍 [Artist Profile] Debug info:', {
      userId: user?.id,
      userIdAsNumber: user?.id ? Number(user.id) : null,
      userIdAsString: user?.id ? String(user.id) : null,
      artistId,
      userProfilePgId: userProfile?.pgId,
      userProfileGeneratedBy: userProfile?.generatedBy,
      userProfileUid: userProfile?.uid,
      userProfileRole: userProfile?.role,
      userProfileIsAIGenerated: userProfile?.isAIGenerated,
      isInMyArtists,
      isOwnProfile,
      isCreator: userProfile?.generatedBy === user?.id,
      userAuthenticated: !!user,
      bannerImage: userProfile?.bannerImage,
      profileImage: userProfile?.profileImage,
      coverImage: userProfile?.coverImage
    });
  }, [user, artistId, userProfile, isOwnProfile, isInMyArtists]);

  // Real, sellable shows from the standalone TICKETING module (Stripe checkout +
  // QR passes + admin-controlled platform commission). These power the public
  // "Upcoming Shows" buy flow; the legacy Firestore `shows` below is only a
  // read-only fallback for profiles that have no module events yet.
  // NOTE: this is the ticketing module — merch monetization belongs to the
  // separate Concert Command Center connector (the `concert-hub` widget).
  const [buyConcertEvent, setBuyConcertEvent] = useState<ShowEvent | null>(null);
  const { data: concertEvents = [] as ShowEvent[], refetch: refetchConcertEvents } = useQuery<ShowEvent[]>({
    queryKey: ["concert-events", userProfile?.pgId || artistId],
    queryFn: async () => {
      try {
        const pgId = userProfile?.pgId || artistId;
        const data = await apiRequest('GET', `/api/concerts/${pgId}/events`);
        const events: any[] = Array.isArray(data?.events) ? data.events : [];
        return events.filter((e) => e.status === 'published' || e.status === 'live') as ShowEvent[];
      } catch (error) {
        logger.error("Error fetching concert events:", error);
        return [] as ShowEvent[];
      }
    },
    enabled: !!(userProfile?.pgId || artistId),
  });

  // Query para shows
  const { data: shows = [] as Show[], refetch: refetchShows} = useQuery<Show[]>({
    queryKey: ["shows", userProfile?.pgId || artistId],
    queryFn: async () => {
      try {
        const pgId = userProfile?.pgId || artistId;
        logger.info(`?? Fetching shows for artist: ${pgId} (PostgreSQL ID)`);
        const showsRef = collection(db, "shows");
        const q = query(showsRef, where("userId", "==", pgId));
        const querySnapshot = await getDocs(q);

        logger.info(`?? Shows query returned ${querySnapshot.size} documents`);

        if (querySnapshot.empty) {
          logger.info('⚠️ No shows found for this artist');
          return [];
        }

        const showsData = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          logger.info('?? Show data:', { id: doc.id, venue: data.venue, date: data.date });
          return {
            id: doc.id,
            venue: data.venue,
            date: data.date,
            location: data.location,
            ticketUrl: data.ticketUrl,
          };
        });
        
        // Ordenar por fecha (m�s pr�ximos primero)
        showsData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        logger.info(`? Successfully loaded ${showsData.length} shows`);
        return showsData;
      } catch (error) {
        logger.error("❌ Error fetching shows:", error);
        return [];
      }
    },
    enabled: !!artistId
  });

  // ── Inline "Upcoming Shows" management (owner) — same backend as Edit Profile
  // and the Concert Center: POST /api/concerts/:id/quick-show. Lets the artist
  // add/remove dates directly from the widget without opening Edit Profile.
  const [showsManagerOpen, setShowsManagerOpen] = useState(false);
  const [newShowForm, setNewShowForm] = useState({ venue: '', date: '', location: '', price: '', capacity: '', ticketUrl: '' });
  const [addingShow, setAddingShow] = useState(false);
  const [deletingShowId, setDeletingShowId] = useState<string | null>(null);
  // Full ticketing/payments/messaging center launched from the Upcoming Shows widget
  const [ticketCenterOpen, setTicketCenterOpen] = useState(false);

  const concertPgId = userProfile?.pgId || artistId;

  const handleAddUpcomingShow = async () => {
    if (!newShowForm.venue.trim() || !newShowForm.date || !newShowForm.location.trim()) {
      toast({ title: 'Campos requeridos', description: 'Completa lugar, fecha y ubicación.', variant: 'destructive' });
      return;
    }
    setAddingShow(true);
    try {
      const priceNum = Math.max(0, Number(newShowForm.price) || 0);
      const data = await apiRequest('POST', `/api/concerts/${concertPgId}/quick-show`, {
        venue: newShowForm.venue.trim(),
        location: newShowForm.location.trim(),
        startsAt: newShowForm.date,
        priceUsd: priceNum,
        capacity: newShowForm.capacity ? parseInt(newShowForm.capacity, 10) : undefined,
        ticketUrl: newShowForm.ticketUrl?.trim() || undefined,
      });
      if (!data?.success) throw new Error(data?.error || 'No se pudo agregar el show');
      toast({
        title: 'Show agregado',
        description: priceNum > 0 ? 'En venta — entradas con QR y pago seguro.' : 'Fecha publicada. Añade un precio para vender entradas.',
      });
      setNewShowForm({ venue: '', date: '', location: '', price: '', capacity: '', ticketUrl: '' });
      await refetchConcertEvents();
      queryClient.invalidateQueries({ queryKey: ['concert-events'] });
      queryClient.invalidateQueries({ queryKey: ['shows'] });
    } catch (error: any) {
      logger.error('Error adding upcoming show:', error);
      toast({ title: 'Error', description: error?.message || 'No se pudo agregar el show.', variant: 'destructive' });
    } finally {
      setAddingShow(false);
    }
  };

  const handleDeleteUpcomingShow = async (showId: string) => {
    setDeletingShowId(showId);
    try {
      const data = await apiRequest('DELETE', `/api/concerts/${concertPgId}/events/${showId}`);
      if (!data?.success) throw new Error(data?.error || 'No se pudo eliminar el show');
      toast({ title: 'Show eliminado' });
      await refetchConcertEvents();
      queryClient.invalidateQueries({ queryKey: ['concert-events'] });
    } catch (error: any) {
      logger.error('Error deleting upcoming show:', error);
      toast({ title: 'Error', description: error?.message || 'No se pudo eliminar el show.', variant: 'destructive' });
    } finally {
      setDeletingShowId(null);
    }
  };

  // Query para noticias
  interface NewsArticle {
    id: number;
    title: string;
    content: string;
    summary: string;
    imageUrl: string;
    category: 'release' | 'performance' | 'collaboration' | 'achievement' | 'lifestyle';
    views: number;
    createdAt: Date;
  }

  const { data: newsArticles = [] as NewsArticle[], refetch: refetchNews } = useQuery<NewsArticle[]>({
    queryKey: ['/api/artist-generator/news', userProfile?.pgId || artistId],
    queryFn: async () => {
      try {
        const pgId = userProfile?.pgId || artistId;
        logger.info(`?? Fetching news for artist: ${pgId} (PostgreSQL ID)`);
        const response = await fetch(`/api/artist-generator/news/${pgId}`);
        
        if (!response.ok) {
          logger.warn('⚠️ News API returned non-OK status:', response.status);
          return [];
        }

        const result = await response.json();
        
        if (result.success && result.news) {
          logger.info(`? Successfully loaded ${result.news.length} news articles`);
          return result.news;
        }
        
        return [];
      } catch (error) {
        logger.error("❌ Error fetching news:", error);
        return [];
      }
    },
    enabled: !!artistId
  });

  const artist = {
    id: userProfile?.pgId || artistId,
    pgId: userProfile?.pgId || artistId,
    slug: initialArtistData?.slug || (userProfile as any)?.slug || null,
    name: initialArtistData?.displayName || initialArtistData?.name || userProfile?.displayName || userProfile?.name || "Artist Name",
    genre: initialArtistData?.genre || userProfile?.genre || "Music Artist",
    location: initialArtistData?.location || userProfile?.location || "",
    profileImage: initialArtistData?.profileImage || initialArtistData?.photoURL || userProfile?.photoURL || userProfile?.profileImage || '/assets/promos/default-profile.jpeg',
    bannerImage: initialArtistData?.bannerImage || userProfile?.bannerImage || null,
    loopVideoUrl: initialArtistData?.loopVideoUrl || userProfile?.loopVideoUrl || null,
    bannerPosition: initialArtistData?.bannerPosition ?? userProfile?.bannerPosition ?? "50",
    biography: initialArtistData?.biography || userProfile?.biography || "Music artist profile",
    followers: userProfile?.followers || 0,
    // ?? Social/streaming widgets: once `userProfile` has loaded from the server
    // it's authoritative � the parent's `initialArtistData` prop is a static snapshot
    // that doesn't update when the user connects/disconnects accounts via the dialog.
    // Using `??` (instead of `||`) preserves an explicitly-cleared empty string so the
    // widget actually disappears when the artist disconnects an account.
    instagram: userProfile ? (userProfile.instagram ?? '') : (initialArtistData?.instagram || ""),
    twitter:   userProfile ? (userProfile.twitter   ?? '') : (initialArtistData?.twitter   || ""),
    youtube:   userProfile ? (userProfile.youtube   ?? '') : (initialArtistData?.youtube   || ""),
    spotify:   userProfile ? (userProfile.spotify   ?? '') : (initialArtistData?.spotify   || ""),
    website: initialArtistData?.website || userProfile?.website || "",
    profileLayout: userProfile?.profileLayout || null,
    pageMode: initialArtistData?.pageMode || userProfile?.pageMode || 'artist',
    blockchainArtistId: initialArtistData?.blockchainArtistId || userProfile?.blockchainArtistId || null,
    isMinted: !!(initialArtistData?.blockchainArtistId || userProfile?.blockchainArtistId),
  };

  /** Extract dominant colours from the artist's profile image and build a
   *  custom colour palette + font pairing that adapts to the image aesthetic. */
  const applyPhotoHarmony = useCallback(async () => {
    if (!artist.profileImage || isExtractingPalette) return;
    setIsExtractingPalette(true);
    try {
      // -- 1. Load image on a small canvas --------------------------
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error('Image load failed'));
        img.src = artist.profileImage!;
        setTimeout(() => rej(new Error('timeout')), 8000);
      });

      const SIZE = 64;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE; canvas.height = SIZE;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

      // -- 2. Sample pixels ? convert to HSL ------------------------
      type HslPixel = { h: number; s: number; l: number; hex: string };
      const pixels: HslPixel[] = [];
      for (let i = 0; i < data.length; i += 16) { // every 4th pixel
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const nr = r / 255, ng = g / 255, nb = b / 255;
        const max = Math.max(nr, ng, nb), min = Math.min(nr, ng, nb);
        const l = (max + min) / 2;
        let s = 0, h = 0;
        if (max !== min) {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          if (max === nr) h = ((ng - nb) / d + (ng < nb ? 6 : 0)) / 6;
          else if (max === ng) h = ((nb - nr) / d + 2) / 6;
          else h = ((nr - ng) / d + 4) / 6;
        }
        // skip very dark, very light, and unsaturated pixels
        if (l > 0.08 && l < 0.92 && s > 0.12) {
          pixels.push({ h: h * 360, s, l, hex: `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}` });
        }
      }

      if (pixels.length < 6) throw new Error('Not enough vibrant pixels');

      // -- 3. Bucket by hue (30� bins) ? find dominant + accent -----
      const buckets: Map<number, HslPixel[]> = new Map();
      pixels.forEach(p => {
        const bin = Math.round(p.h / 30) * 30 % 360;
        if (!buckets.has(bin)) buckets.set(bin, []);
        buckets.get(bin)!.push(p);
      });
      const sorted = [...buckets.entries()].sort((a, b) => b[1].length - a[1].length);
      const dominantBin = sorted[0];
      const accentBin = sorted.find(([bin]) => Math.abs(bin - dominantBin[0]) > 30) ?? sorted[1] ?? sorted[0];

      // Most vivid pixel in each bin (highest S * (1 - |L-0.5|*2))
      const pickVivid = (pxs: HslPixel[]) =>
        pxs.reduce((best, p) => {
          const score = p.s * (1 - Math.abs(p.l - 0.45) * 1.5);
          const bscore = best.s * (1 - Math.abs(best.l - 0.45) * 1.5);
          return score > bscore ? p : best;
        });

      const domPixel = pickVivid(dominantBin[1]);
      const accPixel = pickVivid(accentBin[1]);

      // -- 4. Build hex colors ---------------------------------------
      const hslToHex = (hDeg: number, s: number, l: number): string => {
        const a = s * Math.min(l, 1 - l);
        const f = (n: number) => {
          const k = (n + hDeg / 30) % 12;
          return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
        };
        return `#${f(0).toString(16).padStart(2,'0')}${f(8).toString(16).padStart(2,'0')}${f(4).toString(16).padStart(2,'0')}`;
      };

      const accentHex  = hslToHex(accPixel.h,  Math.min(accPixel.s + 0.15, 1),  Math.max(Math.min(accPixel.l + 0.05, 0.7), 0.45));
      const primaryHex = hslToHex(domPixel.h,  Math.min(domPixel.s + 0.10, 1),  Math.max(Math.min(domPixel.l + 0.05, 0.7), 0.40));
      const borderHex  = hslToHex(accPixel.h,  0.35, 0.18);
      const cardBg1    = hslToHex(domPixel.h,  0.30, 0.06);
      const cardBg2    = hslToHex(domPixel.h,  0.20, 0.03);
      const cardBg3    = hslToHex(accPixel.h,  0.28, 0.05);
      const preview2   = hslToHex(accPixel.h,  0.70, 0.55);

      const palette: ColorPalette = {
        hexAccent:  accentHex,
        hexPrimary: primaryHex,
        hexBorder:  borderHex,
        textMuted: 'gray-300',
        bgGradient: 'bg-gradient-to-br from-black via-gray-950 to-gray-900',
        shadow: 'shadow-black/40',
        category: 'dark',
        cardBg: `linear-gradient(145deg, ${cardBg1} 0%, ${cardBg2} 50%, ${cardBg3} 100%)`,
        cardBorder: 'gradient',
        preview: [primaryHex, accentHex, preview2],
      };

      // -- 5. Font pairing based on dominant hue ---------------------
      const hDom = domPixel.h;
      let fontPair: { heading: string; body: string; gfUrl: string };
      if (hDom < 30 || hDom > 330)      fontPair = { heading: 'Montserrat',    body: 'Inter',           gfUrl: 'Montserrat:wght@700;900' };
      else if (hDom < 80)               fontPair = { heading: 'Bebas Neue',    body: 'Inter',           gfUrl: 'Bebas+Neue' };
      else if (hDom < 150)              fontPair = { heading: 'Nunito',        body: 'Nunito',          gfUrl: 'Nunito:wght@400;700;800' };
      else if (hDom < 200)              fontPair = { heading: 'Space Grotesk', body: 'Space Grotesk',   gfUrl: 'Space+Grotesk:wght@400;700' };
      else if (hDom < 265)              fontPair = { heading: 'Exo 2',         body: 'Exo 2',           gfUrl: 'Exo+2:wght@400;700;900' };
      else                              fontPair = { heading: 'Raleway',       body: 'Raleway',         gfUrl: 'Raleway:wght@400;600;800' };

      // Inject Google Fonts link
      const linkId = 'photo-harmony-font';
      let linkEl = document.getElementById(linkId) as HTMLLinkElement | null;
      if (!linkEl) { linkEl = document.createElement('link'); linkEl.id = linkId; linkEl.rel = 'stylesheet'; document.head.appendChild(linkEl); }
      linkEl.href = `https://fonts.googleapis.com/css2?family=${fontPair.gfUrl}&display=swap`;

      setPhotoPaletteEntry(palette);
      setPhotoFont({ heading: fontPair.heading, body: fontPair.body });
      setSelectedTheme('Photo Harmony' as keyof typeof colorPalettes);
      setPreviewTheme(null);
      autoSaveLayout(sectionOrder, rightOrder, 'Photo Harmony');

      toast({ title: 'Photo Harmony applied', description: 'Profile colors synced to your image palette.' });
    } catch {
      toast({ title: 'Could not extract palette', description: 'Try a different profile image.', variant: 'destructive' });
    } finally {
      setIsExtractingPalette(false);
    }
  }, [artist.profileImage, autoSaveLayout, isExtractingPalette, rightOrder, sectionOrder, toast]);

  const generateAutoNarrativeBlocks = useCallback(async ({ force = false, silent = false }: { force?: boolean; silent?: boolean } = {}) => {
    if (!isOwnProfile || isGeneratingAutoBlocks) return;

    const existingEntries = Object.entries(customBlocks);
    const hasText = existingEntries.some(([, block]) => block.kind === 'text');
    const hasBanner = existingEntries.some(([, block]) => block.kind === 'banner');
    if (!force && hasText && hasBanner) return;

    const existingAiBannerId = existingEntries.find(([, block]) => block.kind === 'banner' && (block as any).source === 'ai-profile-auto' && (block as any).slot === 'banner')?.[0];
    const existingAiTextId = existingEntries.find(([, block]) => block.kind === 'text' && (block as any).source === 'ai-profile-auto' && (block as any).slot === 'text')?.[0];

    setIsGeneratingAutoBlocks(true);
    try {
      const featuredSingle = sortSongsSinglesFirst(songs).find((s) => !!s.audioUrl) || songs[0];
      const response = await fetch('/api/ai/generate-profile-auto-blocks', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistId,
          artistName: artist.name,
          biography: artist.biography,
          genre: artist.genre,
          location: artist.location,
          latestSingleTitle: featuredSingle?.title || featuredSingle?.name || '',
          latestSingleDescription: featuredSingle?.description || '',
          selectedTheme,
          accentColor: colors.hexAccent,
          primaryColor: colors.hexPrimary,
        }),
      });

      if (!response.ok) {
        throw new Error(await response.text().catch(() => 'Failed to generate AI profile blocks'));
      }

      const data = await response.json();
      const bannerId = existingAiBannerId || newCustomBlockId();
      const textId = existingAiTextId || newCustomBlockId();
      const now = Date.now();
      // Build the CTA target. A "Listen Now / Explore" button must always land
      // somewhere that works: prefer a real streaming link, else scroll to the
      // on-page songs player. The EPK is NOT used here because it is often not
      // generated for an artist and would dead-end on an "EPK not found" page.
      const artistSlug = (artist as any)?.slug || '';
      const streamingUrl =
        (artist as any)?.spotify ||
        (artist as any)?.spotifyUrl ||
        (artist as any)?.streamingUrl ||
        (artist as any)?.appleMusic ||
        (artist as any)?.website ||
        '';
      const hasPlayableSongs = Array.isArray(songs) && songs.length > 0;
      const ctaTarget =
        streamingUrl ||
        (hasPlayableSongs ? '#section-songs' : (artistSlug ? `/artist/${artistSlug}` : ''));

      const bannerBlock: CustomBlock = {
        id: bannerId,
        kind: 'banner',
        createdAt: now,
        title: String(data.bannerTitle || `New Era: ${artist.name}`),
        subtitle: String(data.bannerSubtitle || 'Discover the sound, the vision, and the next chapter.'),
        ctaLabel: String(data.ctaLabel || 'Explore Now'),
        // Send fans to the music (streaming or the on-page player), never a
        // missing EPK page.
        ctaUrl: ctaTarget,
        // Leave bgGradient empty so the renderer applies the elegant dark style
        // and uses this gradient on the TEXT (background-clip: text) instead.
        bgGradient: '',
        textColor: '#ffffff',
        align: 'center',
        height: 'md',
        iconName: (data.iconName || 'sparkles') as any,
        iconAnimate: true,
        genreVibe: (data.genreVibe || 'vibrant') as any,
        source: 'ai-profile-auto',
        slot: 'banner',
      } as any;

      const textBlock: CustomBlock = {
        id: textId,
        kind: 'text',
        createdAt: now,
        heading: String(data.textHeading || 'The Story Behind The Sound'),
        body: String(data.textBody || artist.biography || ''),
        align: 'left',
        size: 'md',
        weight: 'medium',
        color: '#f5f5f5',
        decorativeSymbol: (data.decorativeSymbol || '?') as any,
        genreVibe: (data.genreVibe || 'vibrant') as any,
        source: 'ai-profile-auto',
        slot: 'text',
      } as any;

      setCustomBlocks(prev => ({ ...prev, [bannerId]: bannerBlock, [textId]: textBlock }));
      setSectionOrder(prev => {
        const aiIds = [bannerId, textId];
        const cleaned = prev.filter(id => !aiIds.includes(id));
        const songsIdx = cleaned.indexOf('songs');
        const insertAt = songsIdx >= 0 ? songsIdx : 0;
        return [...cleaned.slice(0, insertAt), ...aiIds, ...cleaned.slice(insertAt)];
      });
      setSectionVisibility(prev => ({ ...prev, [bannerId]: true, [textId]: true }));
      setSectionExpanded(prev => ({ ...prev, [bannerId]: true, [textId]: true }));

      if (!silent) {
        toast({
          title: 'AI blocks generated',
          description: 'Banner and artist story were created and added to your layout.',
        });
      }
    } catch (error) {
      logger.error('Failed to generate AI narrative blocks:', error);
      if (!silent) {
        toast({
          variant: 'destructive',
          title: 'Could not generate AI blocks',
          description: 'Please try again in a few seconds.',
        });
      }
    } finally {
      setIsGeneratingAutoBlocks(false);
    }
  }, [artist.biography, artist.genre, artist.location, artist.name, artist.spotify, artist.website, artistId, colors.hexAccent, colors.hexPrimary, customBlocks, isGeneratingAutoBlocks, isOwnProfile, selectedTheme, songs, toast]);

  // Cargar layout desde la base de datos
  useEffect(() => {
    let shouldGenerateAutoBlocks = false;
    if (artist?.profileLayout) {
      layoutSourceRef.current = 'db';
      // Ensure order is a valid array before setting
      const order = artist.profileLayout.order;
      if (Array.isArray(order) && order.length > 0) {
        // Add any new sections that don't exist in saved order
        const missingSections = defaultOrder.filter(s => !order.includes(s));
        setSectionOrder([...order, ...missingSections]);
      } else {
        setSectionOrder(modeConfig.defaultSectionOrder);
      }
      
      // Ensure visibility is a valid object before setting
      const visibility = artist.profileLayout.visibility;
      if (visibility && typeof visibility === 'object' && !Array.isArray(visibility)) {
        // Add default visibility for any new sections not in saved visibility
        const merged = { ...defaultVisibility, ...visibility };
        setSectionVisibility(merged);
      } else {
        setSectionVisibility({ ...getDefaultVisibility(pageMode) });
      }

      // Load expanded state from DB (collapsed by default for better UX)
      const expanded = artist.profileLayout.expanded;
      if (expanded && typeof expanded === 'object' && !Array.isArray(expanded)) {
        setSectionExpanded({ ...defaultExpanded, ...expanded });
      } else {
        setSectionExpanded({ ...defaultExpanded });
      }

      // Load right column order
      const rOrder = (artist.profileLayout as any).rightOrder;
      if (Array.isArray(rOrder) && rOrder.length > 0) {
        const missingRight = defaultRightOrder.filter(s => !rOrder.includes(s));
        setRightOrder([...rOrder, ...missingRight]);
      } else {
        setRightOrder(defaultRightOrder);
      }

      // Load right column expanded state
      const rExpanded = (artist.profileLayout as any).rightExpanded;
      if (rExpanded && typeof rExpanded === 'object' && !Array.isArray(rExpanded)) {
        setRightExpanded({ ...defaultRightExpanded, ...rExpanded });
      } else {
        setRightExpanded(defaultRightExpanded);
      }

      // Load right column visibility state
      const rVisibility = (artist.profileLayout as any).rightVisibility;
      if (rVisibility && typeof rVisibility === 'object' && !Array.isArray(rVisibility)) {
        setRightVisibility({ ...defaultRightVisibility, ...rVisibility });
      } else {
        setRightVisibility(defaultRightVisibility);
      }

      // Load mobile column priority
      const savedMobileFirst = (artist.profileLayout as any).mobileColumnFirst;
      if (savedMobileFirst === 'left' || savedMobileFirst === 'right') {
        setMobileColumnFirst(savedMobileFirst);
      }

      // Load per-module column overrides (left/right placement)
      const savedSideOverride = (artist.profileLayout as any).sideOverride;
      if (savedSideOverride && typeof savedSideOverride === 'object' && !Array.isArray(savedSideOverride)) {
        const cleaned: Record<string, 'left' | 'right'> = {};
        for (const [k, v] of Object.entries(savedSideOverride)) {
          if (v === 'left' || v === 'right') cleaned[k] = v;
        }
        setSideOverride(cleaned);
      }

      // Load saved color theme ('Photo Harmony' is a special virtual key not in colorPalettes)
      const savedTheme = (artist.profileLayout as any).colorTheme;
      if (savedTheme && (savedTheme in colorPalettes || savedTheme === 'Photo Harmony')) {
        setSelectedTheme(savedTheme as keyof typeof colorPalettes);
      }

      // Load saved font key
      const savedFontKey = (artist.profileLayout as any).fontKey;
      if (savedFontKey && FONT_OPTIONS.some(f => f.key === savedFontKey)) {
        setSelectedFont(savedFontKey);
      }

      setLayoutPresets(normalizeLayoutPresets((artist.profileLayout as any).presets));

      // Load saved custom blocks
      const savedBlocks = (artist.profileLayout as any).customBlocks;
      if (savedBlocks && typeof savedBlocks === 'object' && !Array.isArray(savedBlocks)) {
        setCustomBlocks(savedBlocks as Record<string, CustomBlock>);
        const blockValues = Object.values(savedBlocks as Record<string, CustomBlock>);
        const hasText = blockValues.some(b => b?.kind === 'text');
        const hasBanner = blockValues.some(b => b?.kind === 'banner');
        shouldGenerateAutoBlocks = !hasText || !hasBanner;
      } else {
        setCustomBlocks({});
        shouldGenerateAutoBlocks = true;
      }
    } else if (pageMode && pageMode !== 'artist') {
      // No saved layout � apply mode-specific defaults
      layoutSourceRef.current = 'default';
      setSectionOrder(modeConfig.defaultSectionOrder);
      setSectionVisibility(getDefaultVisibility(pageMode));
      setRightOrder(modeConfig.defaultRightWidgets);
      setLayoutPresets([]);
      shouldGenerateAutoBlocks = true;
    } else {
      // No saved layout, no special page mode → fresh profile
      layoutSourceRef.current = 'default';
      setLayoutPresets([]);
    }
    // Mark hydration complete on the next tick so the auto-save effect below
    // does not fire from the state-batched updates we just applied.
    const t = setTimeout(() => {
      hasHydratedLayoutRef.current = true;
      if (isOwnProfile && shouldGenerateAutoBlocks) {
        generateAutoNarrativeBlocks({ silent: true });
      }
    }, 0);
    return () => clearTimeout(t);
  }, [artist?.profileLayout]);

  // Persist visibility / expanded toggles. Order changes already trigger
  // autoSaveLayout directly from the drag handlers; this effect catches
  // the show/hide and expand/collapse toggles which previously only mutated
  // local state and were lost on refresh.
  useEffect(() => {
    // Always keep the ref in sync with the latest committed state so the
    // debounced save body never reads stale values from a closure.
    layoutStateRef.current = {
      sectionOrder,
      sectionVisibility,
      sectionExpanded,
      rightOrder,
      rightVisibility,
      rightExpanded,
      selectedTheme: selectedTheme as string,
      customBlocks,
      mobileColumnFirst,
      selectedFont,
      sideOverride,
      layoutPresets,
    };
    if (!hasHydratedLayoutRef.current) return;
    if (!isOwnProfile) return;
    autoSaveLayout(sectionOrder, rightOrder);
  }, [sectionOrder, sectionVisibility, sectionExpanded, rightOrder, rightVisibility, rightExpanded, selectedTheme, customBlocks, mobileColumnFirst, selectedFont, sideOverride, layoutPresets]);

  // After mount / whenever placement changes, force one re-render so the portal
  // target slots (refs attached during commit) are read and relocated modules
  // appear in their chosen column.
  useEffect(() => {
    setRelocTick(t => t + 1);
  }, [sideOverride, sectionOrder, rightOrder, sectionVisibility, rightVisibility, isOwnProfile]);

  // --- Custom block helpers (text / separator / banner / custom section) ---
  const addCustomBlock = useCallback((block: CustomBlock) => {
    setCustomBlocks(prev => ({ ...prev, [block.id]: block }));
    setSectionOrder(prev => (prev.includes(block.id) ? prev : [...prev, block.id]));
    setSectionVisibility(prev => ({ ...prev, [block.id]: true }));
    setSectionExpanded(prev => ({ ...prev, [block.id]: true }));
    setEditingBlockId(block.id);
  }, []);
  const updateCustomBlock = useCallback((block: CustomBlock) => {
    setCustomBlocks(prev => ({ ...prev, [block.id]: block }));
  }, []);
  const deleteCustomBlock = useCallback((id: string) => {
    setCustomBlocks(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setSectionOrder(prev => prev.filter(s => s !== id));
    setSectionVisibility(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setSectionExpanded(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  // DEBUG: Log completo del perfil de usuario y spotify
  logger.info('🔍 DEBUG - userProfile completo:', userProfile);
  logger.info('🔍 DEBUG - artist.spotify:', artist.spotify);
  logger.info('🔍 DEBUG - getSpotifyEmbedUrl result:', artist.spotify ? getSpotifyEmbedUrl(artist.spotify) : 'NO SPOTIFY URL');

  // ---- Audio queue helpers (Music & Video sections) ----
  // Derive the profile slug once: use the stored DB slug first, then fall back
  // to the current URL path segment so the MiniPlayer icon always routes back
  // to this exact artist page (not a name-derived guess that may differ).
  const artistProfileSlug = (artist as any)?.slug
    || window.location.pathname.split('/artist/')[1]?.split('/')[0]
    || artist?.name?.toLowerCase().replace(/\s+/g, '-')
    || '';

  const songToTrack = (s: Song): AudioTrack => ({
    id: String(s.id),
    title: s.title || s.name || "Untitled",
    artist: (artist as any)?.artistName || artist?.name || "Artist",
    audioUrl: s.audioUrl,
    coverArt: s.coverArt || undefined,
    sourceHref: `/artist/${encodeURIComponent(artistProfileSlug)}`,
    previewLimitSeconds: isSongLocked(s) ? previewSeconds : undefined,
  });

  const sortSongsSinglesFirst = (list: Song[]): Song[] => {
    // Respect custom displayOrder when present on any song
    const hasOrder = list.some((s) => typeof (s as any).displayOrder === 'number');
    let ordered = hasOrder
      ? [...list].sort((a, b) => {
          const ao = typeof (a as any).displayOrder === 'number' ? (a as any).displayOrder : 9999;
          const bo = typeof (b as any).displayOrder === 'number' ? (b as any).displayOrder : 9999;
          return ao - bo;
        })
      : [...list];
    const single = ordered.find((s) => s.isSingle);
    if (!single) return ordered;
    return [single, ...ordered.filter((s) => s.id !== single.id)];
  };

  // Mirror the global player's current track id into local state so existing
  // inline UI that uses `playingSongId === song.id` keeps highlighting correctly.
  useEffect(() => {
    if (audioPlayer.isPlaying && audioPlayer.currentTrack) {
      setPlayingSongId(String(audioPlayer.currentTrack.id));
    } else if (!audioPlayer.currentTrack) {
      setPlayingSongId(null);
    } else if (!audioPlayer.isPlaying) {
      // Paused ? don't show as "playing"
      setPlayingSongId(null);
    }
  }, [audioPlayer.currentTrack?.id, audioPlayer.isPlaying]);

  // Esc closes fullscreen module overlay, body scroll-lock while open.
  useEffect(() => {
    if (!fullscreenSectionId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreenSectionId(null);
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [fullscreenSectionId]);

  // Auto-hide chrome on first paint after 4s (clean profile UX).
  useEffect(() => {
    chromeHideTimerRef.current = setTimeout(() => setChromeVisible(false), 4000);
    return () => {
      if (chromeHideTimerRef.current) clearTimeout(chromeHideTimerRef.current);
    };
  }, []);
  // Keep chrome visible while a module is in fullscreen (overlay has its own bar).
  useEffect(() => {
    if (fullscreenSectionId) {
      if (chromeHideTimerRef.current) clearTimeout(chromeHideTimerRef.current);
      setChromeVisible(true);
    }
  }, [fullscreenSectionId]);

  const handlePlayPause = (song: Song) => {
    // Validate playable URL
    if (!song.audioUrl || song.audioUrl.startsWith('ipfs://')) {
      toast({
        title: "Audio no disponible",
        description: "Esta canci�n es una versi�n tokenizada. El audio real se a�adir� pr�ximamente.",
      });
      return;
    }

    // If this song is already the active track, toggle play/pause
    if (audioPlayer.currentTrack?.id === String(song.id)) {
      audioPlayer.toggle();
      return;
    }

    // Otherwise, build a queue starting at the clicked song so the user
    // can listen "song after song" automatically.
    const ordered = sortSongsSinglesFirst(songs);
    const startIndex = Math.max(
      0,
      ordered.findIndex((s) => s.id === song.id),
    );
    audioPlayer.playQueue(ordered.map(songToTrack), {
      startIndex,
      autoplay: true,
      muted: false, // user gesture ? can play with sound
    });
  };

  const openMiniStudioForSong = (song: Song) => {
    const params = new URLSearchParams();
    const artistId = String((artist as any)?.pgId || (artist as any)?.firestoreId || artist?.id || song.userId || '');
    if (artistId) params.set('artistId', artistId);
    params.set('songId', String(song.id));
    params.set('song', song.title || song.name || 'Song');
    params.set('artist', (artist as any)?.artistName || artist?.name || 'Artist');
    if (song.audioUrl) params.set('audioUrl', song.audioUrl);
    if (song.coverArt) params.set('coverArt', song.coverArt);
    window.location.href = `/mini-studio?${params.toString()}`;
  };

  // Mark / unmark a song as the artist's "single" (pinned).
  const handleToggleSingle = async (song: Song) => {
    try {
      const isCurrentlySingle = !!song.isSingle;
      const r: any = await apiRequest(`/api/songs/${song.id}/set-single`, {
        method: "POST",
        data: { isSingle: !isCurrentlySingle },
      });
      if (!r?.success) throw new Error(r?.message || "Failed");
      // Optimistically update the songs cache so the star button reflects the
      // change immediately without waiting for a Firestore round-trip.
      const songsKey = ["songs", userProfile?.firestoreId || artistId];
      queryClient.setQueryData(songsKey, (old: Song[] = []) =>
        old.map((s) => ({
          ...s,
          isSingle: s.id === song.id ? !isCurrentlySingle : (isCurrentlySingle ? s.isSingle : false),
        }))
      );
      toast({
        title: isCurrentlySingle ? "Single removed" : "Marked as single ?",
        description: isCurrentlySingle
          ? "This song is no longer pinned."
          : "It will play first when fans open your profile.",
      });
      refetchSongs();
    } catch (err: any) {
      toast({
        title: "Could not update single",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    // Share the rich social card URL: it serves OG/Twitter meta tags with a
    // spectacular generated image (profile photo + bio excerpt + branding)
    // so WhatsApp/Facebook/X/Telegram render an eye-catching preview, then
    // redirects human visitors to the artist profile.
    const artistName = (artist as any)?.artistName || artist?.name || 'this artist';
    const slugOrId = (artist as any)?.slug || (artist as any)?.pgId || (artist as any)?.id;
    const shareUrl = slugOrId
      ? `${window.location.origin}/api/artist-share/${encodeURIComponent(String(slugOrId))}`
      : `${window.location.href.split('#')[0]}#music`;
    const shareText = `🎵 Listen to ${artistName} on Boostify Music — play their tracks right from this link.`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${artistName} — Music on Boostify`,
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        logger.error('Error sharing:', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
      } catch {
        // Fallback for very old browsers
        await navigator.clipboard.writeText(shareUrl);
      }
      toast({
        title: "Music link copied!",
        description: "Share it anywhere — it shows a rich artist card preview.",
      });
    }
  };

  // Strip audio extension to derive a default title from the filename.
  const stripAudioExt = (name: string) => name.replace(/\.(mp3|wav|flac|m4a|aac|ogg|opus|webm)$/i, '').trim();

  // Adds files chosen via the file input to the bulk queue, defaulting the
  // title to the filename without extension. Existing pending items are kept.
  const handleSongFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setBulkSongQueue(prev => {
      const next = [...prev];
      for (const f of files) {
        next.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          file: f,
          title: stripAudioExt(f.name),
          coverArt: null,
          coverArtPreview: null,
          status: 'pending',
          progress: 0,
        });
      }
      return next;
    });
    // reset the input so selecting the same file again works
    e.target.value = '';
  };

  // Uploads every pending item in the queue sequentially.
  const handleBulkUploadSongs = async () => {
    const pending = bulkSongQueue.filter(item => item.status === 'pending' || item.status === 'error');
    if (pending.length === 0) {
      toast({ title: 'No files to upload', description: 'Add audio files first.', variant: 'destructive' });
      return;
    }
    setIsUploadingSong(true);
    let okCount = 0;
    for (const item of pending) {
      const title = item.title.trim() || stripAudioExt(item.file.name) || 'Untitled';
      try {
        setBulkSongQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'uploading', progress: 0, error: undefined } : q));
        const storageRef = ref(storage, `songs/${artistId}/${Date.now()}_${item.file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, item.file);
        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed',
            (snap) => {
              const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
              setBulkSongQueue(prev => prev.map(q => q.id === item.id ? { ...q, progress: pct } : q));
              setSongUploadProgress(pct);
            },
            (err) => reject(err),
            () => resolve()
          );
        });
        const audioUrl = await getDownloadURL(storageRef);
        // Upload cover art if provided, otherwise fall back to default
        let coverArtUrl = '/assets/freepik__boostify_music_organe_abstract_icon.png';
        if (item.coverArt) {
          const coverRef = ref(storage, `songs/${artistId}/${Date.now()}_cover_${item.coverArt.name}`);
          await uploadBytes(coverRef, item.coverArt);
          coverArtUrl = await getDownloadURL(coverRef);
        }
        const newDocRef = doc(collection(db, 'songs'));
        // The songs query searches by `artistId == firestoreArtistId` first
        // and falls back to `userId == pgId`. Write BOTH so the song shows up
        // immediately on the artist profile and on any user-keyed view.
        const firestoreArtistId = String((userProfile as any)?.firestoreId || artistId);
        const pgIdStr = userProfile?.pgId ? String(userProfile.pgId) : null;
        await setDoc(newDocRef, {
          name: title,
          title,
          audioUrl,
          artistId: firestoreArtistId,
          userId: pgIdStr || firestoreArtistId,
          createdAt: new Date(),
          storageRef: storageRef.fullPath,
          coverArt: coverArtUrl,
          isSingle: false,
          // Optional album/group label so the catalog can be organized
          // by album from the artist profile UI.
          album: (item.album || bulkAlbumDefault || '').trim() || null,
        });
        setBulkSongQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'done', progress: 100 } : q));
        okCount++;
      } catch (error: any) {
        logger.error('Error uploading song:', error);
        setBulkSongQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: error?.message || 'Upload failed' } : q));
      }
    }
    setIsUploadingSong(false);
    setSongUploadProgress(0);
    if (okCount > 0) {
      toast({
        title: okCount === 1 ? 'Song uploaded' : `${okCount} songs uploaded`,
        description: 'Your library has been updated.',
      });
      refetchSongs();
    }
  };

  // Legacy single-song handler retained as a thin wrapper that adds the file
  // to the bulk queue (the unified dialog drives the rest).
  const handleUploadSong = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleSongFilesSelected(e);
  };

  // Load the best available music style context when the generate dialog opens
  const loadMusicStyleContext = async () => {
    setIsFetchingStyle(true);
    const pgId = userProfile?.pgId;

    if (pgId) {
      try {
        const res = await fetch(`/api/artist-blueprint/${pgId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.hasBlueprint && data.blueprint?.sound) {
            const s = data.blueprint.sound;
            const extracted = {
              primaryGenre: s.primary_genre || '',
              vocalStyle: s.vocal_style || '',
              productionStyle: s.production_style || '',
              influences: Array.isArray(s.sonic_influences) ? s.sonic_influences : [],
              moodKeywords: Array.isArray(s.mood_keywords) ? s.mood_keywords : [],
              lyricThemes: Array.isArray(s.lyric_themes) ? s.lyric_themes : [],
              signatureSound: s.signature_sound || '',
            };
            setBlueprintStyle(extracted);
            setStyleSource('blueprint');
            // Auto-set mood to first blueprint keyword if it matches known values
            const knownMoods: Array<'energetic' | 'mellow' | 'upbeat' | 'dark' | 'romantic'> = ['energetic', 'mellow', 'upbeat', 'dark', 'romantic'];
            const firstKw = (extracted.moodKeywords[0] || '').toLowerCase();
            const match = knownMoods.find(m => firstKw.includes(m));
            if (match) setAiSongMood(match);
            setIsFetchingStyle(false);
            return;
          }
        }
      } catch { /* silent */ }
    }

    // Fallback: use existing songs' genre data
    if (songs.length > 0) {
      const genreFromSongs = songs[0]?.genre || '';
      if (genreFromSongs) {
        setBlueprintStyle(null);
        setStyleSource('songs');
        setIsFetchingStyle(false);
        return;
      }
    }

    // Last resort: manual
    setBlueprintStyle(null);
    setStyleSource('manual');
    setIsFetchingStyle(false);
  };

  // Funci�n para generar canci�n con IA (FAL AI MiniMax)
  const handleGenerateAISong = async () => {
    // T�tulo es opcional - si no se proporciona, el backend genera uno autom�ticamente

    setIsGeneratingAISong(true);
    try {
      const artistName = artist?.name || (artist as any)?.artistName || 'Artist';
      // Genre: blueprint overrides artist profile overrides default
      const baseGenre = artist?.genre || 'pop';
      const genre = (styleSource === 'blueprint' && blueprintStyle?.primaryGenre) ? blueprintStyle.primaryGenre : baseGenre;
      const firestoreArtistId = userProfile?.firestoreId || artistId;
      const artistBio = artist?.biography || '';
      
      // Build blueprint payload
      const blueprintPayload = styleSource === 'blueprint' && blueprintStyle ? {
        blueprintPrimaryGenre: blueprintStyle.primaryGenre,
        blueprintVocalStyle: blueprintStyle.vocalStyle,
        blueprintProductionStyle: blueprintStyle.productionStyle,
        blueprintInfluences: blueprintStyle.influences,
        blueprintMoodKeywords: blueprintStyle.moodKeywords,
        blueprintLyricThemes: blueprintStyle.lyricThemes,
        blueprintSignatureSound: blueprintStyle.signatureSound,
      } : {};

      // Send manual style if applicable
      const manualPayload = styleSource === 'manual' && manualMusicStyle.trim()
        ? { manualMusicStyle: manualMusicStyle.trim() }
        : {};

      const response = await fetch('/api/artist-generator/generate-single-song', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          artistName,
          songTitle: aiSongPrompt.trim() || '',
          genre,
          mood: aiSongMood,
          artistId: firestoreArtistId,
          artistGender: (artist as any)?.gender || (userProfile as any)?.gender || 'male',
          artistBio,
          ...blueprintPayload,
          ...manualPayload,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate song');
      }

      const result = await response.json();
      const generatedTitle = result.song?.title || aiSongPrompt || 'New Song';
      
      toast({
        title: "Song Generated!",
        description: `"${generatedTitle}" has been created with AI.`,
      });

      setAiSongPrompt('');
      setShowGenerateAISongDialog(false);
      refetchSongs();
    } catch (error) {
      logger.error("Error generating AI song:", error);
      toast({
        title: "Generation failed",
        description: "Could not generate the song. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingAISong(false);
    }
  };

  const handleDeleteSong = async (song: Song) => {
    if (!confirm(`Are you sure you want to delete "${song.name}"?`)) return;

    try {
      await deleteDoc(doc(db, "songs", song.id));
      
      if (song.storageRef) {
        try {
          const storageRef = ref(storage, song.storageRef);
          await deleteObject(storageRef);
        } catch (err) {
          logger.error("Error deleting file from storage:", err);
        }
      }

      toast({
        title: "Song deleted",
        description: "The song has been removed.",
      });

      refetchSongs();
    } catch (error) {
      logger.error("Error deleting song:", error);
      toast({
        title: "Delete failed",
        description: "Could not delete the song. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Save changes from the Manage Songs dialog: rename + reorder
  const handleSaveManageSongs = async () => {
    setIsSavingManage(true);
    try {
      const originalMap = new Map(songs.map((s) => [String(s.id), s.title || (s as any).name || '']));
      const updates = manageSongsList.map(async (item, index) => {
        const origTitle = originalMap.get(String(item.id)) || '';
        const titleChanged = item.title.trim() && item.title.trim() !== origTitle;
        // For string IDs (Firestore docs): update directly via client SDK
        if (typeof item.id === 'string' && !/^\d+$/.test(item.id)) {
          const fields: Record<string, any> = { displayOrder: index };
          if (titleChanged) fields.title = item.title.trim();
          await updateDoc(doc(db, 'songs', item.id), fields);
        } else {
          // Numeric Postgres ID: always persist displayOrder; title if changed
          const pgUpdateFields: Record<string, any> = { displayOrder: index };
          if (titleChanged) pgUpdateFields.title = item.title.trim();
          await apiRequest(`/api/songs/${item.id}`, {
            method: 'PUT',
            data: pgUpdateFields,
          });
          // Also update Firestore doc if firestoreId available
          const srcSong = songs.find((s) => String(s.id) === String(item.id));
          if (srcSong && (srcSong as any).firestoreId) {
            const fields: Record<string, any> = { displayOrder: index };
            if (titleChanged) fields.title = item.title.trim();
            await updateDoc(doc(db, 'songs', (srcSong as any).firestoreId), fields);
          }
        }
      });
      await Promise.all(updates);
      // Optimistically update the songs cache with the new order/titles so the
      // profile reflects changes immediately without waiting for Firestore sync.
      const songsKey = ["songs", userProfile?.firestoreId || artistId];
      queryClient.setQueryData(songsKey, (old: Song[] = []) => {
        const orderMap = new Map(manageSongsList.map((item, idx) => [String(item.id), { order: idx, title: item.title.trim() }]));
        return [...old].sort((a, b) => {
          const ao = orderMap.get(String(a.id))?.order ?? 9999;
          const bo = orderMap.get(String(b.id))?.order ?? 9999;
          return ao - bo;
        }).map((s) => {
          const update = orderMap.get(String(s.id));
          return update?.title ? { ...s, title: update.title, name: update.title } : s;
        });
      });
      toast({ title: 'Songs updated' });
      setShowManageSongsDialog(false);
      refetchSongs();
    } catch (err: any) {
      toast({ title: 'Save failed', description: err?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setIsSavingManage(false);
    }
  };

  const handleUploadVideo = async () => {
    if (!newVideoTitle.trim()) {
      toast({
        title: "Error",
        description: "Por favor proporciona un t�tulo para el video.",
        variant: "destructive",
      });
      return;
    }

    if (videoUploadType === 'youtube' && !newVideoUrl.trim()) {
      toast({
        title: "Error",
        description: "Por favor proporciona una URL de YouTube.",
        variant: "destructive",
      });
      return;
    }

    if (videoUploadType === 'file' && !videoFile) {
      toast({
        title: "Error",
        description: "Por favor selecciona un archivo de video.",
        variant: "destructive",
      });
      return;
    }

    if (videoUploadType === 'file' && !videoPassword.trim()) {
      toast({
        title: "Error",
        description: "Por favor proporciona un password para proteger la descarga del video.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingVideo(true);
    setVideoUploadProgress(0);
    try {
      // Upload optional PDF script first
      let scriptPdfUrl: string | undefined;
      let scriptPdfPath: string | undefined;
      if (videoPdfFile) {
        scriptPdfPath = `video-scripts/${artistId}/${Date.now()}_${videoPdfFile.name}`;
        const pdfRef = ref(storage, scriptPdfPath);
        await uploadBytes(pdfRef, videoPdfFile);
        scriptPdfUrl = await getDownloadURL(pdfRef);
      }

      if (videoUploadType === 'youtube') {
        const newDocRef = doc(collection(db, "videos"));
        await setDoc(newDocRef, {
          title: newVideoTitle,
          url: newVideoUrl,
          type: 'youtube',
          userId: artistId,
          createdAt: new Date(),
          ...(scriptPdfUrl && { scriptPdfUrl, scriptPdfPath }),
        });
      } else {
        const fileExt = videoFile!.name.split('.').pop()?.toLowerCase() || 'mp4';
        const storagePath = `videos/${artistId}/${Date.now()}_${videoFile!.name}`;
        const storageRef = ref(storage, storagePath);
        
        const uploadTask = uploadBytesResumable(storageRef, videoFile!);
        
        await new Promise((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setVideoUploadProgress(Math.round(progress));
              logger.info(`?? Video upload progress: ${progress}%`);
            },
            (error) => reject(error),
            () => resolve(uploadTask.snapshot)
          );
        });
        
        const downloadURL = await getDownloadURL(storageRef);
        
        const newDocRef = doc(collection(db, "videos"));
        await setDoc(newDocRef, {
          title: newVideoTitle,
          url: downloadURL,
          type: 'uploaded',
          storagePath: storagePath,
          downloadPassword: videoPassword,
          fileFormat: fileExt,
          fileSize: videoFile!.size,
          userId: artistId,
          createdAt: new Date(),
          ...(scriptPdfUrl && { scriptPdfUrl, scriptPdfPath }),
        });
      }

      toast({
        title: "�Video agregado!",
        description: videoUploadType === 'youtube' 
          ? "Tu video de YouTube ha sido agregado exitosamente." 
          : "Tu video ha sido subido y est� protegido con password.",
      });

      setNewVideoTitle('');
      setNewVideoUrl('');
      setVideoFile(null);
      setVideoPassword('');
      setVideoPdfFile(null);
      setShowUploadVideoDialog(false);
      setVideoUploadProgress(0);
      refetchVideos();
    } catch (error) {
      logger.error("Error uploading video:", error);
      toast({
        title: "Error al subir",
        description: "No se pudo agregar el video. Por favor intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingVideo(false);
      setVideoUploadProgress(0);
    }
  };

  const handleDeleteVideo = async (video: Video) => {
    if (!confirm(`Are you sure you want to delete "${video.title}"?`)) return;

    try {
      await deleteDoc(doc(db, "videos", video.id));

      if (video.storagePath && video.type === 'uploaded') {
        try {
          const storageRef = ref(storage, video.storagePath);
          await deleteObject(storageRef);
        } catch (err) {
          logger.error("Error deleting file from storage:", err);
        }
      }

      if (video.scriptPdfPath) {
        try {
          const pdfRef = ref(storage, video.scriptPdfPath);
          await deleteObject(pdfRef);
        } catch (err) {
          logger.error("Error deleting PDF from storage:", err);
        }
      }

      toast({
        title: "Video eliminado",
        description: "El video ha sido removido.",
      });

      refetchVideos();
    } catch (error) {
      logger.error("Error deleting video:", error);
      toast({
        title: "Error al eliminar",
        description: "No se pudo eliminar el video. Por favor intenta de nuevo.",
        variant: "destructive",
      });
    }
  };

  const handleUploadPdfToVideo = async (videoId: string, file: File) => {
    setUploadingPdfForVideoId(videoId);
    try {
      const scriptPdfPath = `video-scripts/${artistId}/${Date.now()}_${file.name}`;
      const pdfRef = ref(storage, scriptPdfPath);
      await uploadBytes(pdfRef, file);
      const scriptPdfUrl = await getDownloadURL(pdfRef);

      const videoDocRef = doc(db, "videos", videoId);
      const { updateDoc } = await import("firebase/firestore");
      await updateDoc(videoDocRef, { scriptPdfUrl, scriptPdfPath });

      toast({
        title: "�Script PDF subido!",
        description: "El gui�n del video se ha subido exitosamente.",
      });
      refetchVideos();
    } catch (error) {
      logger.error("Error uploading PDF:", error);
      toast({
        title: "Error al subir PDF",
        description: "No se pudo subir el PDF. Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setUploadingPdfForVideoId(null);
    }
  };

  const handleDownloadVideo = async (video: Video) => {
    if (!video.downloadPassword) {
      toast({
        title: "Error",
        description: "Este video no tiene un password configurado.",
        variant: "destructive",
      });
      return;
    }

    setDownloadVideoId(video.id);
    setShowDownloadDialog(true);
  };

  const handleConfirmDownload = async () => {
    const video = videos.find(v => v.id === downloadVideoId);
    if (!video) return;

    if (downloadPasswordInput !== video.downloadPassword) {
      toast({
        title: "Password Incorrecto",
        description: "El password ingresado no es correcto.",
        variant: "destructive",
      });
      return;
    }

    try {
      const link = document.createElement('a');
      link.href = video.url;
      link.download = `${video.title}.${video.fileFormat || 'mp4'}`;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "�Descarga iniciada!",
        description: "El video se est� descargando.",
      });

      setShowDownloadDialog(false);
      setDownloadVideoId(null);
      setDownloadPasswordInput('');
    } catch (error) {
      logger.error("Error downloading video:", error);
      toast({
        title: "Error al descargar",
        description: "No se pudo descargar el video. Por favor intenta de nuevo.",
        variant: "destructive",
      });
    }
  };

  const glowBorder = colors.cardBorder === 'glow'
    ? `0 0 12px ${colors.hexAccent}18, inset 0 0 12px ${colors.hexAccent}06`
    : '';
  const cardStyles = `rounded-2xl p-5 shadow-lg ${colors.shadow} transition-all duration-300 overflow-hidden`;
  const cardBgValue = String(colors.cardBg || '');
  const cardBgIsGradient = cardBgValue.includes('gradient(');
  const cardStyleInline: React.CSSProperties = {
    ...(cardBgIsGradient
      ? { backgroundImage: cardBgValue, backgroundColor: 'transparent' }
      : { backgroundColor: cardBgValue || 'transparent' }),
    borderColor: colors.cardBorder === 'gradient' ? 'transparent' : colors.hexBorder,
    borderWidth: '1px',
    borderStyle: 'solid',
    ...(colors.cardBorder === 'gradient' ? {
      borderImage: `linear-gradient(135deg, ${colors.preview[0]}, ${colors.preview[1]}, ${colors.preview[2]}) 1`,
    } : {}),
    ...(glowBorder ? { boxShadow: glowBorder } : {}),
    backdropFilter: 'blur(16px)',
  };
  const primaryBtn = `py-2 px-4 rounded-full text-sm font-semibold transition duration-300 shadow-lg whitespace-nowrap`;

  // Reusable section header renderer � clean, consistent look
  const renderSectionHeader = (
    sId: string,
    SectionIcon: any,
    title: string,
    count?: number | string,
    headerRight?: React.ReactNode
  ) => {
    const isPinnedOpen = false;
    const isOpen = isPinnedOpen || !!sectionExpanded[sId];
    return (
    <div className="flex items-center justify-between gap-3 mb-4">
      <button
        onClick={() => {
          if (isPinnedOpen) return;
          setSectionExpanded(prev => ({ ...prev, [sId]: !prev[sId] }));
        }}
        className={`flex-1 text-left flex items-center gap-2.5 hover:opacity-90 transition-opacity min-w-0 ${isPinnedOpen ? 'cursor-default' : ''}`}
        data-testid={`button-toggle-section-${sId}`}
      >
        <div
          className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${colors.hexAccent}12` }}
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4" style={{ color: colors.hexAccent }} />
          ) : (
            <ChevronRight className="h-4 w-4" style={{ color: colors.hexAccent }} />
          )}
        </div>
        <SectionIcon className="h-[18px] w-[18px] flex-shrink-0" style={{ color: colors.hexAccent }} />
        <span className="text-[15px] font-semibold text-white truncate">{title}</span>
        {count !== undefined && count !== null && (
          <span
            className="flex-shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-md"
            style={{ backgroundColor: `${colors.hexAccent}12`, color: colors.hexAccent }}
          >
            {count}
          </span>
        )}
      </button>
      <div className="flex items-center gap-2 flex-shrink-0">
        {isPinnedOpen && (
          <span
            className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full"
            style={{
              color: '#a5f3fc',
              border: '1px solid rgba(34,211,238,0.55)',
              background: 'rgba(8,47,73,0.45)',
              boxShadow: '0 0 14px rgba(34,211,238,0.35)',
            }}
          >
            Always On
          </span>
        )}
        {headerRight}
        {isOwnProfile && !isPinnedOpen && (
          <button
            title="Cerrar m�dulo"
            onClick={(e) => {
              e.stopPropagation();
              setSectionVisibility(prev => ({ ...prev, [sId]: false }));
            }}
            className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center opacity-40 hover:opacity-100 hover:bg-red-500/20 transition-all duration-200"
            data-testid={`button-close-section-${sId}`}
          >
            <X className="h-3 w-3 text-gray-400 hover:text-red-400" />
          </button>
        )}
      </div>
    </div>
  );
  };
  
  const merchCategories = ['Todo', 'Music', 'Videos', 'Shows'];
  const totalPlays = songs.reduce((acc, song) => {
    // Handle duration as string "M:SS" or number (seconds)
    if (typeof song.duration === 'string' && song.duration.includes(':')) {
      return acc + (parseInt(song.duration.split(':')[0] || '0') * 100);
    } else if (typeof song.duration === 'number') {
      return acc + (Math.floor(song.duration / 60) * 100);
    }
    return acc;
  }, 0);


  // --- Broadcast Studio helpers (component-scope) ------------------------------
  const handleModuleToggle = (mod: { id: string; side: 'left' | 'right' }, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Non-owners: navigate to section (read-only)
    if (!isOwnProfile) {
      const targetId = mod.side === 'left' ? `section-${mod.id}` : `widget-${mod.id}`;
      const scrollToEl = (retries: number) => {
        const el = document.getElementById(targetId);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        else if (retries > 0) setTimeout(() => scrollToEl(retries - 1), 200);
      };
      scrollToEl(3);
      return;
    }
    if (mod.side === 'left') {
      const wasActive = sectionVisibility[mod.id] !== false;
      if (wasActive) {
        setSectionVisibility(prev => ({ ...prev, [mod.id]: false }));
        setSectionExpanded(prev => ({ ...prev, [mod.id]: false }));
      } else {
        setSectionVisibility(prev => ({ ...prev, [mod.id]: true }));
        setSectionExpanded(prev => ({ ...prev, [mod.id]: true }));
        const scrollToEl = (retries: number) => {
          const el = document.getElementById(`section-${mod.id}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          else if (retries > 0) setTimeout(() => scrollToEl(retries - 1), 200);
        };
        setTimeout(() => scrollToEl(3), 400);
      }
      autoSaveLayout();
    } else {
      const wasActive = rightVisibility[mod.id] !== false;
      if (wasActive) {
        setRightVisibility(prev => ({ ...prev, [mod.id]: false }));
      } else {
        setRightVisibility(prev => ({ ...prev, [mod.id]: true }));
        const scrollToEl = (retries: number) => {
          const el = document.getElementById(`widget-${mod.id}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          else if (retries > 0) setTimeout(() => scrollToEl(retries - 1), 200);
        };
        setTimeout(() => scrollToEl(3), 400);
      }
      autoSaveLayout();
    }
  };

  const renderModuleGrid = (items: { id: string; name: string; icon: React.ComponentType<any>; side: 'left' | 'right' }[]) =>
    items.map((mod) => {
      const ModIcon = mod.icon;
      const isActive = mod.side === 'left'
        ? sectionVisibility[mod.id] !== false
        : rightVisibility[mod.id] !== false;
      const isFeatured = mod.id === 'songs' || mod.id === 'videos';
      // Clear ON/OFF semantics: active = neon green (featured stays premium gold),
      // inactive = visible red so disabled modules never vanish into the dark UI.
      const NEON_GREEN = '#22e06b';
      const OFF_RED = '#ef4444';
      const activeColor = isFeatured ? '#FFD700' : NEON_GREEN;
      const isDragOver = studioDragOverId === mod.id;
      return (
        <button
          key={mod.id}
          draggable={isOwnProfile}
          onDragStart={(e) => {
            e.stopPropagation();
            studioDraggedRef.current = { id: mod.id, side: mod.side };
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (studioDraggedRef.current?.side === mod.side && studioDraggedRef.current.id !== mod.id) {
              setStudioDragOverId(mod.id);
            }
          }}
          onDragLeave={(e) => { e.stopPropagation(); setStudioDragOverId(null); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setStudioDragOverId(null);
            const from = studioDraggedRef.current;
            studioDraggedRef.current = null;
            if (!from || from.id === mod.id || from.side !== mod.side) return;
            if (from.side === 'left') {
              const newOrder = [...sectionOrder];
              const fi = newOrder.indexOf(from.id);
              const ti = newOrder.indexOf(mod.id);
              if (fi < 0 || ti < 0) return;
              newOrder.splice(fi, 1);
              newOrder.splice(ti, 0, from.id);
              setSectionOrder(newOrder);
              autoSaveLayout(newOrder);
            } else {
              const newRight = [...rightOrder];
              const fi = newRight.indexOf(from.id);
              const ti = newRight.indexOf(mod.id);
              if (fi < 0 || ti < 0) return;
              newRight.splice(fi, 1);
              newRight.splice(ti, 0, from.id);
              setRightOrder(newRight);
              autoSaveLayout(sectionOrder, newRight);
            }
          }}
          onDragEnd={(e) => { e.stopPropagation(); studioDraggedRef.current = null; setStudioDragOverId(null); }}
          onClick={(e) => handleModuleToggle(mod, e)}
          onTouchEnd={(e) => { e.preventDefault(); handleModuleToggle(mod, e); }}
          title={isOwnProfile ? `Toggle / drag to reorder: ${mod.name.replace(/[^\w\s]/g, '').trim()}` : `Go to ${mod.name.replace(/[^\w\s]/g, '').trim()}`}
          className="flex flex-col items-center gap-1 p-1 sm:p-2 rounded-lg sm:rounded-xl border transition-all duration-300 hover:scale-105 active:scale-95"
          style={{
            background: isDragOver ? `${activeColor}22` : isActive ? `${activeColor}14` : `${OFF_RED}12`,
            borderColor: isDragOver ? activeColor : isActive ? `${activeColor}55` : `${OFF_RED}45`,
            cursor: isOwnProfile ? 'grab' : 'pointer',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            outline: isDragOver ? `1px dashed ${activeColor}70` : 'none',
            transform: isDragOver ? 'scale(1.06)' : undefined,
          }}
        >
          <div
            className="w-6 h-6 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all duration-300"
            style={{
              background: isActive
                ? isFeatured
                  ? 'radial-gradient(circle at 35% 35%, #FFD70038, rgba(0,0,0,0.7))'
                  : `radial-gradient(circle at 35% 35%, ${activeColor}38, rgba(0,0,0,0.7))`
                : `radial-gradient(circle at 35% 35%, ${OFF_RED}26, rgba(0,0,0,0.55))`,
              boxShadow: isActive
                ? isFeatured
                  ? '0 0 18px #FFD70066'
                  : `0 0 18px ${activeColor}77`
                : `0 0 6px ${OFF_RED}33`,
            }}
          >
            <ModIcon
              style={{
                width: 12, height: 12,
                color: isActive ? activeColor : OFF_RED,
                filter: isActive ? `drop-shadow(0 0 6px ${activeColor}cc)` : `drop-shadow(0 0 2px ${OFF_RED}66)`,
              }}
            />
          </div>
          <span
            className="text-[7px] sm:text-[8px] font-medium text-center leading-tight line-clamp-2"
            style={{ color: isActive ? 'rgba(255,255,255,0.85)' : 'rgba(248,113,113,0.9)', maxWidth: 42 }}
          >
            {mod.name.replace(/[^\w\s]/g, '').trim().split(' ').slice(0, 2).join(' ')}
          </span>
        </button>
      );
    });

  return (
    <>
    <ListeningExperience
      primary={colors.hexPrimary}
      accent={colors.hexAccent}
      artistName={(artist as any)?.artistName || artist?.name || 'Artist'}
      artistImageUrl={artist?.profileImage}
      videoUrl={artist?.loopVideoUrl}
      pgId={artist?.pgId}
      artistId={artistId}
    />
    <DragDropContext onDragEnd={handleDragEnd}>
    <div
      className={`min-h-screen text-white transition-colors duration-500 overflow-x-hidden ${colors.bgGradient}${selectedFont !== 'default' && !isPhotoHarmony ? ' artist-profile-font-scope' : ''}`}
      style={{ margin: 0, padding: 0 }}
      onClick={(e) => {
        // Tap on empty area toggles chrome; ignore clicks on interactive elements.
        const target = e.target as HTMLElement | null;
        if (!target) return;
        if (target.closest('button, a, input, textarea, select, [role="button"], [data-chrome-keep]')) return;
        toggleChrome();
      }}
    >
      {/* ── Animated background orbs ── theme-aware aurora with scroll parallax */}
      <ParallaxOrbs hexPrimary={colors.hexPrimary} hexAccent={colors.hexAccent} />

      <audio ref={audioRef} onEnded={() => setPlayingSongId(null)} />
      
      {/* Hero Header - Dise�o Ultra Premium 2025 */}
      <header className="relative h-[100dvh] w-full overflow-hidden" style={{ margin: 0, padding: 0, top: 0, left: 0 }}>
        {/* Background con efecto cinematogr�fico */}
        <div className="absolute inset-0">
          {(() => {
            const DEFAULT_HERO_VIDEO = '/assets/promos/boostify-2025-profile-v2.mp4';
            const bannerPos = artist.bannerPosition || "50";
            const objectPositionStyle = `center ${bannerPos}%`;
            
            // Prioridad: loopVideoUrl (video dedicado) > bannerImage (imagen o video subido) > video por defecto
            // Si hay loopVideoUrl real, usarlo como video
            if (artist.loopVideoUrl) {
              return (
                <video
                  key={artist.loopVideoUrl}
                  src={artist.loopVideoUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  crossOrigin="anonymous"
                  className="absolute inset-0 w-full h-full object-cover filter brightness-40 contrast-110 saturate-110 scale-110 transition-all duration-1000 hover:scale-105 hover:brightness-45"
                  style={{ objectPosition: objectPositionStyle }}
                  onError={(e) => logger.error('Hero video error:', e)}
                />
              );
            }
            
            // Si hay bannerImage, detectar si es video o imagen
            if (artist.bannerImage) {
              const isVideo = artist.bannerImage.match(/\.(mp4|mov|avi|webm)$/i) || 
                             artist.bannerImage.includes('video') ||
                             artist.bannerImage.includes('.mp4') ||
                             artist.bannerImage.includes('.webm') ||
                             artist.bannerImage.includes('.mov');
              
              if (isVideo) {
                return (
                  <video
                    key={artist.bannerImage}
                    src={artist.bannerImage}
                    autoPlay
                    muted
                    loop
                    playsInline
                    crossOrigin="anonymous"
                    className="absolute inset-0 w-full h-full object-cover filter brightness-40 contrast-110 saturate-110 scale-110 transition-all duration-1000 hover:scale-105 hover:brightness-45"
                    style={{ objectPosition: objectPositionStyle }}
                    onError={(e) => logger.error('Hero video error:', e)}
                  />
                );
              }
              
              // Es una imagen - mostrarla como imagen
              return (
                <img
                  src={artist.bannerImage}
                  alt={`${artist.name} Cover`}
                  className="absolute inset-0 w-full h-full object-cover filter brightness-40 contrast-110 saturate-110 scale-110 transition-all duration-1000 hover:scale-105 hover:brightness-45"
                  style={{ objectPosition: objectPositionStyle }}
                  onError={(e) => { 
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.parentElement) {
                      e.currentTarget.parentElement.style.background = `radial-gradient(circle at 50% 50%, ${colors.hexPrimary}20 0%, #000000 100%)`;
                    }
                  }}
                />
              );
            }
            
            // Sin banner ni video - usar video por defecto
            return (
              <video
                key={DEFAULT_HERO_VIDEO}
                autoPlay
                muted
                loop
                playsInline
                className="absolute inset-0 w-full h-full object-cover filter brightness-40 contrast-110 saturate-110 scale-110 transition-all duration-1000 hover:scale-105 hover:brightness-45"
                style={{ objectPosition: objectPositionStyle }}
                onError={(e) => logger.error('Hero video error:', e)}
              >
                <source src={DEFAULT_HERO_VIDEO} type="video/mp4" />
              </video>
            );
          })()}
        </div>

        {/* Overlay gradiente cinematogr�fico */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/20"></div>
        <div 
          className="absolute inset-0 opacity-30"
          style={{
            background: `radial-gradient(circle at 30% 50%, ${colors.hexAccent}15 0%, transparent 60%)`
          }}
        ></div>
        
        {/* Grid animado de fondo */}
        <div className="absolute inset-0 opacity-5" 
          style={{
            backgroundImage: `
              linear-gradient(${colors.hexAccent}40 1px, transparent 1px),
              linear-gradient(90deg, ${colors.hexAccent}40 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
            animation: 'grid-move 20s linear infinite'
          }}
        ></div>
        
        {/* Part�culas flotantes mejoradas */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full blur-sm"
              style={{
                width: `${Math.random() * 6 + 2}px`,
                height: `${Math.random() * 6 + 2}px`,
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                backgroundColor: colors.hexAccent,
                opacity: Math.random() * 0.4 + 0.1,
                animation: `float ${Math.random() * 10 + 15}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 5}s`
              }}
            />
          ))}
        </div>
        
        {/* Barra superior con glassmorphism */}
        <div className="absolute top-0 left-0 right-0 p-4 md:p-6 z-30" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 0px) + 0.5rem)' }}>
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-2 md:gap-3 backdrop-blur-xl bg-black/30 px-4 py-2.5 rounded-2xl border border-white/10">
              <img 
                src="/assets/boostify-logo.svg" 
                alt="Boostify Logo"
                className="w-7 h-7 md:w-8 md:h-8"
              />
              <div className="hidden sm:block">
                <div className="text-xs font-bold uppercase tracking-wider text-white">Boostify Music</div>
              </div>
            </div>
            <div
              className={`flex gap-2 md:gap-3 transition-opacity duration-300 ${chromeVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              aria-hidden={!chromeVisible}
            >
              <LanguageSwitcher accentColor={colors.hexAccent} />

              {/* Install as App button - visible when PWA is installable or on iOS */}
              {typeof window !== 'undefined' && !window.matchMedia('(display-mode: standalone)').matches && (
                <button 
                  className="px-4 md:px-6 py-2.5 md:py-3 rounded-2xl text-sm md:text-base font-semibold transition-all duration-300 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 transform hover:scale-105 active:scale-95 animate-pulse hover:animate-none"
                  style={{ color: colors.hexAccent }}
                  onClick={() => {
                    // Dispatch custom event that the parent page (artist-profile.tsx) listens for
                    window.dispatchEvent(new CustomEvent('boostify-install-app'));
                  }}
                  data-testid="button-install-app"
                >
                  <Smartphone className="h-4 w-4 md:h-5 md:w-5 inline mr-0 md:mr-2" />
                  <span className="hidden md:inline">Instalar App</span>
                </button>
              )}
              <button 
                className="px-4 md:px-6 py-2.5 md:py-3 rounded-2xl text-sm md:text-base font-semibold transition-all duration-300 backdrop-blur-xl bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 transform hover:scale-105 active:scale-95"
                style={{ color: colors.hexAccent }}
                onClick={handleShare}
                data-testid="button-share"
              >
                <Share2 className="h-4 w-4 md:h-5 md:w-5 inline mr-0 md:mr-2" />
                <span className="hidden md:inline">Compartir</span>
              </button>
              {isOwnProfile && (
                <>
                  <Link href="/dashboard">
                    <button 
                      className="px-4 md:px-6 py-2.5 md:py-3 rounded-2xl text-sm md:text-base font-bold transition-all duration-300 transform hover:scale-105 active:scale-95"
                      style={{ 
                        background: `linear-gradient(135deg, ${colors.hexAccent} 0%, ${colors.hexPrimary} 100%)`,
                        boxShadow: `0 8px 24px ${colors.hexAccent}40`
                      }}
                      data-testid="button-dashboard"
                    >
                      Dashboard
                    </button>
                  </Link>
                  <Link href={`/artist/${userProfile?.slug || String(artistId)}/flow`}>
                    <button
                      className="px-4 md:px-5 py-2.5 md:py-3 rounded-2xl text-sm font-bold transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center gap-1.5"
                      style={{
                        background: 'rgba(99,102,241,0.15)',
                        border: '1px solid rgba(99,102,241,0.4)',
                        color: '#a78bfa',
                      }}
                      title="Open Node Flow Editor"
                    >
                      <Workflow className="w-4 h-4" />
                      <span className="hidden md:inline">Node Flow</span>
                    </button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Contenido principal del hero - Layout centrado */}
        <div className="absolute inset-0 flex items-center justify-center z-20">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
            <div className="text-center space-y-6 md:space-y-8">
              
              {/* Nombre del artista */}
              <div className="space-y-3">
                <h1 
                  className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-black leading-none tracking-tighter"
                  style={{
                    backgroundImage: `linear-gradient(135deg, #FFFFFF 0%, ${colors.hexAccent} 30%, ${colors.hexPrimary} 50%, ${colors.hexAccent} 70%, #FFFFFF 100%)`,
                    backgroundSize: '200% 200%',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    filter: `drop-shadow(0 0 40px ${colors.hexAccent}90) drop-shadow(0 4px 20px rgba(0,0,0,0.9))`,
                    animation: 'gradient-x 6s ease infinite',
                    textTransform: 'uppercase',
                    letterSpacing: '-0.05em'
                  }}
                  data-testid="text-artist-name"
                >
                  {artist.name}
                </h1>

                {/* MINT Badge for minted artists */}
                {artist.isMinted && (
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-green-500/20 border border-green-500/40 text-green-400 font-bold text-sm tracking-wider shadow-lg shadow-green-500/10">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                      MINT #{artist.blockchainArtistId}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">ON-CHAIN</span>
                  </div>
                )}
                
                {/* L�nea decorativa bajo el nombre */}
                <div className="flex items-center justify-center gap-3">
                  <div 
                    className="h-1 w-16 md:w-24 rounded-full"
                    style={{ 
                      background: `linear-gradient(90deg, transparent, ${colors.hexAccent}, transparent)`,
                      boxShadow: `0 0 20px ${colors.hexAccent}80`
                    }}
                  ></div>
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: colors.hexAccent, boxShadow: `0 0 20px ${colors.hexAccent}` }}
                  ></div>
                  <div 
                    className="h-1 w-16 md:w-24 rounded-full"
                    style={{ 
                      background: `linear-gradient(90deg, transparent, ${colors.hexAccent}, transparent)`,
                      boxShadow: `0 0 20px ${colors.hexAccent}80`
                    }}
                  ></div>
                </div>
              </div>

              {/* G�nero y ubicaci�n con �conos */}
              <div className="flex flex-wrap items-center justify-center gap-4 text-xl md:text-2xl lg:text-3xl font-bold"
                style={{ textShadow: `0 2px 20px rgba(0,0,0,0.8), 0 0 40px ${colors.hexAccent}40` }}>
                {/* Mode badge - only show for non-artist modes */}
                {pageMode !== 'artist' && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border border-white/20 backdrop-blur-sm"
                        style={{ backgroundColor: `${modeConfig.color}20`, color: modeConfig.color }}>
                        {modeConfig.emoji} {modeConfig.heroTitle}
                      </span>
                    </div>
                    <span className="inline-block w-2 h-2 rounded-full bg-white/40 mx-1"></span>
                  </>
                )}
                <div className="flex items-center gap-2">
                  <Music className="h-5 w-5 md:h-6 md:w-6" style={{ color: colors.hexAccent, filter: `drop-shadow(0 0 6px ${colors.hexAccent}80)` }} />
                  <span className="text-white">{artist.genre || modeConfig.defaultGenreLabel}</span>
                </div>
                {artist.location && (
                  <>
                    <span className="inline-block w-2 h-2 rounded-full bg-white/40 mx-1"></span>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 md:h-6 md:w-6" style={{ color: colors.hexAccent, filter: `drop-shadow(0 0 6px ${colors.hexAccent}80)` }} />
                      <span className="text-white/90">{formatLocation(artist.location)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Estad�sticas mejoradas */}
              <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 mt-6">
                {songs.length > 0 && (
                  <div className="group relative">
                    <div 
                      className="absolute -inset-2 rounded-3xl blur-xl opacity-50 group-hover:opacity-80 transition-all duration-300"
                      style={{ backgroundColor: colors.hexAccent }}
                    ></div>
                    <div className="relative backdrop-blur-2xl bg-gradient-to-br from-white/20 to-white/5 border-2 rounded-3xl px-6 md:px-8 py-4 md:py-6 transform group-hover:scale-110 transition-all duration-300"
                      style={{ borderColor: `${colors.hexAccent}60` }}
                    >
                      <div className="text-4xl md:text-5xl font-black mb-1" style={{ color: colors.hexAccent }}>{songs.length}</div>
                      <div className="text-xs md:text-sm text-white font-bold uppercase tracking-widest">Canciones</div>
                    </div>
                  </div>
                )}
                {videos.length > 0 && (
                  <div className="group relative">
                    <div 
                      className="absolute -inset-2 rounded-3xl blur-xl opacity-50 group-hover:opacity-80 transition-all duration-300"
                      style={{ backgroundColor: colors.hexAccent }}
                    ></div>
                    <div className="relative backdrop-blur-2xl bg-gradient-to-br from-white/20 to-white/5 border-2 rounded-3xl px-6 md:px-8 py-4 md:py-6 transform group-hover:scale-110 transition-all duration-300"
                      style={{ borderColor: `${colors.hexAccent}60` }}
                    >
                      <div className="text-4xl md:text-5xl font-black mb-1" style={{ color: colors.hexAccent }}>{videos.length}</div>
                      <div className="text-xs md:text-sm text-white font-bold uppercase tracking-widest">Videos</div>
                    </div>
                  </div>
                )}
                {artist.instagram && (
                  <div className="group relative">
                    <div 
                      className="absolute -inset-2 rounded-3xl blur-xl opacity-50 group-hover:opacity-80 transition-all duration-300"
                      style={{ backgroundColor: colors.hexAccent }}
                    ></div>
                    <div className="relative backdrop-blur-2xl bg-gradient-to-br from-white/20 to-white/5 border-2 rounded-3xl px-6 md:px-8 py-4 md:py-6 flex flex-col items-center gap-2 transform group-hover:scale-110 transition-all duration-300"
                      style={{ borderColor: `${colors.hexAccent}60` }}
                    >
                      <Instagram className="h-6 w-6 md:h-8 md:w-8" style={{ color: colors.hexAccent }} />
                      <span className="text-sm md:text-base font-black text-white">@{artist.instagram}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Foto de perfil circular abajo + Badge de verificaci�n */}
              <div className="relative z-40 inline-block mt-4 pointer-events-auto" data-chrome-keep>
                <div 
                  className="absolute -inset-4 rounded-full blur-3xl opacity-50 animate-pulse pointer-events-none"
                  style={{ backgroundColor: colors.hexAccent }}
                ></div>
                <div className="relative">
                  <img
                    src={artist.profileImage}
                    alt={`${artist.name} Avatar`}
                    className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full object-cover border-4 shadow-2xl transform hover:scale-110 transition-all duration-500 mx-auto"
                    style={{ 
                      borderColor: colors.hexAccent,
                      boxShadow: `0 20px 60px ${colors.hexAccent}70, 0 0 40px ${colors.hexAccent}50, inset 0 0 20px rgba(255,255,255,0.1)`
                    }}
                    data-testid="img-profile"
                  />
                  <div 
                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center font-black text-sm shadow-2xl transform hover:rotate-12 transition-all duration-300"
                    style={{ 
                      background: `linear-gradient(135deg, ${colors.hexAccent} 0%, ${colors.hexPrimary} 100%)`,
                      boxShadow: `0 10px 30px ${colors.hexAccent}70`
                    }}
                  >
                    <Music2 className="h-4 w-4 text-white" />
                  </div>
                </div>
                {/* Badge de verificaci�n - peque�o debajo de foto */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-xl bg-white/5 border shadow-lg mt-3"
                  style={{ 
                    borderColor: `${colors.hexAccent}30`,
                    boxShadow: `0 4px 16px ${colors.hexAccent}20`
                  }}
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" style={{ boxShadow: '0 0 8px #4ade80' }}></div>
                  <span className="text-xs font-semibold text-white/90 tracking-wide">Verified</span>
                </div>

                {/* Sign-in / logout � small discrete link below Verified badge */}
                <div className="relative z-50 mt-2 flex justify-center pointer-events-auto">
                  {isAuthenticated ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleHeroSignOut();
                      }}
                      className="relative z-50 flex items-center gap-1 px-3 py-1 rounded-full text-[11px] text-white/40 hover:text-white/70 border border-white/10 hover:bg-white/8 transition-all duration-200 pointer-events-auto"
                      title="Sign out"
                      data-testid="button-hero-signout"
                    >
                      <LogOut className="h-2.5 w-2.5" />
                      <span>Sign out</span>
                    </button>
                  ) : (
                    <a
                      href="/auth"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleHeroSignIn();
                      }}
                      className="relative z-50 flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium border transition-colors duration-200 pointer-events-auto"
                      style={{
                        color: colors.hexAccent,
                        borderColor: `${colors.hexAccent}40`,
                        background: `${colors.hexAccent}15`,
                      }}
                      title="Sign in"
                      data-testid="button-hero-signin"
                    >
                      <LogIn className="h-2.5 w-2.5" />
                      <span>Sign in</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Indicador de scroll */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 animate-bounce pointer-events-none">
          <ChevronDown className="h-8 w-8 md:h-10 md:w-10 text-white/60" />
        </div>

        {/* Borde inferior decorativo mejorado */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-1.5"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${colors.hexAccent} 30%, ${colors.hexPrimary} 50%, ${colors.hexAccent} 70%, transparent 100%)`,
            boxShadow: `0 0 30px ${colors.hexAccent}90, 0 0 60px ${colors.hexAccent}50`
          }}
        ></div>
      </header>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 pt-0 pb-4 md:pb-8 box-border">
        {/* Font injection — Photo Harmony or manual font selector */}
        {isPhotoHarmony && photoFont ? (
          <style>{`
            .photo-harmony-scope { font-family: '${photoFont.body}', system-ui, sans-serif !important; }
            .photo-harmony-scope h1,.photo-harmony-scope h2,.photo-harmony-scope h3,.photo-harmony-scope h4 { font-family: '${photoFont.heading}', system-ui, sans-serif !important; }
          `}</style>
        ) : (selectedFont !== 'default' && FONT_OPTIONS.find(f => f.key === selectedFont)) ? (
          <style>{`
            .artist-profile-font-scope { font-family: '${FONT_OPTIONS.find(f => f.key === selectedFont)!.body}', system-ui, sans-serif !important; }
            .artist-profile-font-scope h1,.artist-profile-font-scope h2,.artist-profile-font-scope h3,.artist-profile-font-scope h4 { font-family: '${FONT_OPTIONS.find(f => f.key === selectedFont)!.heading}', system-ui, sans-serif !important; }
          `}</style>
        ) : null}

        {/* Selector de Paleta - Solo visible para el dueño del perfil */}
        {isOwnProfile && (
          <div className={`mb-6 rounded-2xl bg-gray-900/80 backdrop-blur-sm transition-colors duration-500 overflow-hidden${isPhotoHarmony ? ' photo-harmony-scope' : (selectedFont !== 'default' ? ' artist-profile-font-scope' : '')}`}
            style={cardStyleInline}>
            
            {/* Header � always visible */}
            <button
              onClick={() => setShowThemeSelector(!showThemeSelector)}
              className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-3">
                {/* Color preview dots with glow when Smart Color Sync is active */}
                <div className="flex gap-1">
                  {(isPhotoHarmony && photoPaletteEntry ? photoPaletteEntry.preview : colorPalettes[selectedTheme]?.preview ?? []).map((c, i) => (
                    <div
                      key={i}
                      className="w-3 h-3 rounded-full transition-all duration-300"
                      style={{
                        background: c,
                        boxShadow: isPhotoHarmony ? `0 0 6px ${c}90` : 'none',
                      }}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium text-white">Customize Your Style</span>
                {isPhotoHarmony ? (
                  <span
                    className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded-full font-bold tracking-wide"
                    style={{ background: `${colors.hexAccent}22`, color: colors.hexAccent, border: `1px solid ${colors.hexAccent}50` }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: colors.hexAccent }} />
                    SMART
                  </span>
                ) : (
                  <span className="text-xs text-gray-400 flex items-center gap-1"><Palette className="h-3 w-3" /> {selectedTheme as string}</span>
                )}
              </div>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${showThemeSelector ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Expanded panel */}
            {showThemeSelector && (
              <div className="px-5 pb-5 pt-2">

                {/* -- Smart Color Sync --------------------------------------- */}
                {artist.profileImage && (
                  <div
                    className="relative mb-5 rounded-2xl overflow-hidden transition-all duration-500"
                    style={{
                      background: isPhotoHarmony && photoPaletteEntry
                        ? `linear-gradient(135deg, ${photoPaletteEntry.hexPrimary}20 0%, ${photoPaletteEntry.hexAccent}28 60%, ${photoPaletteEntry.hexPrimary}14 100%)`
                        : 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                      border: isPhotoHarmony && photoPaletteEntry
                        ? `1px solid ${photoPaletteEntry.hexAccent}55`
                        : '1px solid rgba(255,255,255,0.10)',
                      boxShadow: isPhotoHarmony && photoPaletteEntry
                        ? `0 0 35px ${photoPaletteEntry.hexAccent}18, inset 0 1px 0 ${photoPaletteEntry.hexAccent}25`
                        : 'none',
                    }}
                  >
                    {/* Radial glow backdrop when active */}
                    {isPhotoHarmony && photoPaletteEntry && (
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background: `radial-gradient(ellipse at 50% -10%, ${photoPaletteEntry.hexAccent}18 0%, transparent 65%)`,
                        }}
                      />
                    )}

                    <div className="relative p-4">
                      {/* Top row: image + info + toggle */}
                      <div className="flex items-start gap-3">

                        {/* Profile image with glow ring when active */}
                        <div className="relative flex-shrink-0">
                          {isPhotoHarmony && photoPaletteEntry && (
                            <div
                              className="absolute -inset-1 rounded-xl opacity-60 blur-sm pointer-events-none"
                              style={{ background: `${photoPaletteEntry.hexAccent}50` }}
                            />
                          )}
                          <img
                            src={artist.profileImage}
                            alt=""
                            className="relative w-14 h-14 rounded-xl object-cover transition-all duration-500"
                            style={{
                              border: isPhotoHarmony && photoPaletteEntry
                                ? `2px solid ${photoPaletteEntry.hexAccent}90`
                                : '2px solid rgba(255,255,255,0.15)',
                            }}
                          />
                          {/* ON badge */}
                          {isPhotoHarmony && photoPaletteEntry && (
                            <div
                              className="absolute -top-1.5 -right-1.5 px-1.5 py-px rounded-full text-[8px] font-black tracking-widest"
                              style={{ background: photoPaletteEntry.hexAccent, color: '#000', boxShadow: `0 0 8px ${photoPaletteEntry.hexAccent}80` }}
                            >
                              ON
                            </div>
                          )}
                        </div>

                        {/* Label + description */}
                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-white">Smart Color Sync</span>
                            {isPhotoHarmony && (
                              <span
                                className="inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-bold tracking-wider"
                                style={{ background: `${colors.hexAccent}22`, color: colors.hexAccent, border: `1px solid ${colors.hexAccent}45` }}
                              >
                                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: colors.hexAccent }} />
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">
                            {isPhotoHarmony && photoPaletteEntry
                              ? `Gradients, borders & font synced to your photo`
                              : 'Auto-extract palette & fonts from your profile photo'}
                          </p>
                          {/* Font pair badge when active */}
                          {isPhotoHarmony && photoFont && (
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <span className="text-[10px] text-gray-500">Font:</span>
                              <span
                                className="text-[10px] font-semibold px-2 py-px rounded"
                                style={{ background: `${colors.hexAccent}18`, color: colors.hexAccent }}
                              >
                                {photoFont.heading}
                              </span>
                              <span className="text-[10px] text-gray-600">/ {photoFont.body}</span>
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                          {isPhotoHarmony ? (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); void applyPhotoHarmony(); }}
                                disabled={isExtractingPalette}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50"
                                style={{ background: `${photoPaletteEntry!.hexAccent}22`, color: photoPaletteEntry!.hexAccent, border: `1px solid ${photoPaletteEntry!.hexAccent}55` }}
                              >
                                {isExtractingPalette
                                  ? <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                                  : <span>?</span>
                                }
                                {isExtractingPalette ? 'Syncing�' : 'Re-sync'}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPhotoPaletteEntry(null);
                                  setPhotoFont(null);
                                  const fallback = 'Boostify Naranja' as keyof typeof colorPalettes;
                                  setSelectedTheme(fallback);
                                  setPreviewTheme(null);
                                  autoSaveLayout(sectionOrder, rightOrder, 'Boostify Naranja');
                                  toast({ title: 'Smart Color Sync off', description: 'Switched back to manual theme.' });
                                }}
                                className="flex items-center justify-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium text-gray-500 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-all duration-200"
                              >
                                ? Deactivate
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); void applyPhotoHarmony(); }}
                              disabled={isExtractingPalette}
                              className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50"
                              style={{ background: `${colors.hexAccent}25`, color: colors.hexAccent, border: `1px solid ${colors.hexAccent}55` }}
                            >
                              {isExtractingPalette ? (
                                <><span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />Analyzing�</>
                              ) : (
                                <>? Activate</>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Extracted palette strip � shown when active */}
                      {isPhotoHarmony && photoPaletteEntry && (
                        <div
                          className="flex items-center gap-2 mt-3 pt-3"
                          style={{ borderTop: `1px solid ${photoPaletteEntry.hexAccent}22` }}
                        >
                          <span className="text-[10px] text-gray-500 flex-shrink-0">Palette</span>
                          <div className="flex gap-2 flex-1">
                            {photoPaletteEntry.preview.map((c, i) => (
                              <div
                                key={i}
                                className="w-6 h-6 rounded-full border-2 border-black/30 transition-transform hover:scale-110"
                                style={{ background: c, boxShadow: `0 0 10px ${c}70` }}
                              />
                            ))}
                          </div>
                          {/* Color hex preview */}
                          <div className="flex gap-1">
                            {photoPaletteEntry.preview.slice(0, 2).map((c, i) => (
                              <span key={i} className="text-[9px] font-mono text-gray-500">{c}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Category tabs */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    onClick={() => setThemeCategory('all')}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      themeCategory === 'all'
                        ? 'text-white shadow-lg'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                    }`}
                    style={themeCategory === 'all' ? { background: colors.hexAccent + '30', color: colors.hexAccent, boxShadow: `0 0 12px ${colors.hexAccent}30` } : {}}
                  >
                    ?? All
                  </button>
                  {paletteCategories.map(cat => (
                    <button
                      key={cat.key}
                      onClick={() => setThemeCategory(cat.key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        themeCategory === cat.key
                          ? 'text-white shadow-lg'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                      }`}
                      style={themeCategory === cat.key ? { background: colors.hexAccent + '30', color: colors.hexAccent, boxShadow: `0 0 12px ${colors.hexAccent}30` } : {}}
                    >
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>

                {/* Palette grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {Object.entries(colorPalettes)
                    .filter(([, p]) => themeCategory === 'all' || p.category === themeCategory)
                    .map(([name, palette]) => {
                      const isActive = name === selectedTheme;
                      const isPaletteLocked = !tierLimits.isPaletteAvailable(name);
                      return (
                        <button
                          key={name}
                          onClick={() => {
                            if (isPaletteLocked) return;
                            setSelectedTheme(name as keyof typeof colorPalettes);
                            setPreviewTheme(null);
                            autoSaveLayout(sectionOrder, rightOrder, name);
                          }}
                          onMouseEnter={() => !isPaletteLocked && setPreviewTheme(name)}
                          onMouseLeave={() => setPreviewTheme(null)}
                          className={`group relative rounded-xl p-3 text-left transition-all duration-300 ${
                            isPaletteLocked
                              ? 'opacity-50 cursor-not-allowed'
                              : isActive
                              ? 'ring-2 scale-[1.02]'
                              : 'hover:scale-[1.02] hover:bg-white/5'
                          }`}
                          style={{
                            background: palette.cardBg,
                            borderColor: isActive ? palette.hexAccent : palette.hexBorder,
                            borderWidth: '1px',
                            ...(isActive ? { ringColor: palette.hexAccent, boxShadow: `0 0 20px ${palette.hexAccent}40` } : {}),
                          }}
                        >
                          {/* Color preview dots */}
                          <div className="flex gap-1.5 mb-2">
                            {palette.preview.map((c, i) => (
                              <div
                                key={i}
                                className="w-4 h-4 rounded-full transition-transform group-hover:scale-110"
                                style={{
                                  background: c,
                                  boxShadow: palette.cardBorder === 'glow' ? `0 0 8px ${c}80` : 'none',
                                }}
                              />
                            ))}
                          </div>
                          
                          {/* Palette name */}
                          <p className="text-xs font-medium text-white truncate">{name}</p>
                          
                          {/* Border style indicator */}
                          <div className="mt-1.5 h-0.5 rounded-full opacity-60"
                            style={{
                              background: palette.cardBorder === 'gradient'
                                ? `linear-gradient(90deg, ${palette.preview[0]}, ${palette.preview[1]}, ${palette.preview[2]})`
                                : palette.cardBorder === 'glow'
                                ? palette.hexAccent
                                : palette.hexBorder,
                              boxShadow: palette.cardBorder === 'glow' ? `0 0 6px ${palette.hexAccent}80` : 'none',
                            }}
                          />

                          {/* Active checkmark */}
                          {isActive && (
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                              style={{ background: palette.hexAccent }}>
                              ?
                            </div>
                          )}
                          {/* Lock icon for premium palettes */}
                          {isPaletteLocked && !isActive && (
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center bg-gray-700/80">
                              <Lock className="h-3 w-3 text-gray-400" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                </div>

                {/* Font Selector */}
                <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${colors.hexAccent}20` }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Typography</span>
                    {isPhotoHarmony ? (
                      <span className="text-[10px] text-gray-500 px-2 py-0.5 rounded-full bg-white/5">Smart Color Sync is controlling fonts</span>
                    ) : selectedFont !== 'default' ? (
                      <button onClick={() => setSelectedFont('default')} className="text-[10px] text-gray-500 hover:text-white px-2 py-0.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors">Reset</button>
                    ) : null}
                  </div>
                  <div className={`grid grid-cols-3 sm:grid-cols-4 gap-2 transition-opacity ${isPhotoHarmony ? 'opacity-40 pointer-events-none select-none' : ''}`}>
                    {FONT_OPTIONS.map(opt => {
                      const isFontActive = selectedFont === opt.key;
                      return (
                        <button
                          key={opt.key}
                          onClick={() => { setSelectedFont(opt.key); autoSaveLayout(sectionOrder, rightOrder, selectedTheme as string); }}
                          className={`relative flex flex-col items-start gap-1 p-2.5 rounded-xl border transition-all text-left ${isFontActive ? 'ring-1' : 'border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]'}`}
                          style={isFontActive ? { borderColor: colors.hexAccent, background: `${colors.hexAccent}12`, boxShadow: `0 0 14px ${colors.hexAccent}22` } : {}}
                        >
                          <span
                            className="text-lg font-bold leading-none text-white"
                            style={{ fontFamily: opt.key === 'default' ? 'system-ui, sans-serif' : `'${opt.heading}', system-ui, sans-serif` }}
                          >
                            Aa
                          </span>
                          <span className="text-[9px] text-gray-400 truncate w-full leading-tight">{opt.label}</span>
                          <span className="text-[8px] px-1.5 py-0.5 rounded-full" style={{ background: `${colors.hexAccent}18`, color: colors.hexAccent }}>
                            {opt.style}
                          </span>
                          {isFontActive && (
                            <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px]" style={{ background: colors.hexAccent }}>
                              ✓
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Main Layout */}
        <main className={`grid grid-cols-1 lg:grid-cols-[1fr_0.75fr] xl:grid-cols-[1.3fr_1fr] gap-4 sm:gap-5 overflow-hidden ${mobileColumnFirst === 'right' ? 'flex flex-col-reverse lg:!grid' : ''}`}>
          {/* Columna Izquierda */}
          <section className="flex flex-col gap-4 min-w-0">
            
            {/* Tarjeta de Information de Artista */}
            <div className={cardStyles} style={cardStyleInline}>
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 md:gap-6">
                <div className="relative flex-shrink-0">
                  <img
                    src={artist.profileImage}
                    alt={`${artist.name} Avatar`}
                    className="w-32 h-32 sm:w-36 sm:h-36 md:w-44 md:h-44 rounded-2xl sm:rounded-3xl object-cover shadow-xl transition-all duration-500"
                    style={{ borderColor: colors.hexBorder, borderWidth: '1px', boxShadow: `0 4px 10px ${colors.hexAccent}50` }}
                    data-testid="img-profile"
                  />
                  <div className="absolute -right-1 -bottom-1 py-1 px-2.5 text-xs rounded-full bg-green-500 text-green-950 font-semibold shadow-xl shadow-green-500/50">
                    Verified
                  </div>
                </div>
                <div className="flex-1 min-w-0 text-center sm:text-left">
                  <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-start">
                    <div className="text-2xl sm:text-3xl font-semibold text-white">{artist.name}</div>
                    {userProfile?.role === 'admin' && (
                      <div 
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-lg"
                        data-testid="badge-admin"
                      >
                        <Crown className="h-3.5 w-3.5" />
                        ADMIN
                      </div>
                    )}
                    {userProfile?.isAIGenerated && (
                      <div 
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg"
                        data-testid="badge-virtual-artist"
                      >
                        <Bot className="h-3.5 w-3.5" />
                        Virtual Artist
                      </div>
                    )}
                  </div>
                  <div 
                    className="text-sm sm:text-base mt-1 transition-colors duration-500" 
                    style={{ color: colors.hexAccent }}
                  >
                    {artist.genre}
                  </div>
                  <div className="text-sm sm:text-base text-gray-400 mt-2 transition-colors duration-500 line-clamp-3">
                    {artist.biography}
                  </div>
                  
                  <div className="flex flex-wrap gap-2 sm:gap-3 mt-4 justify-center sm:justify-start">
                    {isOwnProfile ? (
                      <>
                        <EditProfileDialog
                          artistId={String(userProfile?.pgId || artistId)}
                          currentData={{
                            displayName: userProfile?.displayName || userProfile?.name || "",
                            biography: userProfile?.biography || "",
                            genre: userProfile?.genre || "",
                            location: userProfile?.location || "",
                            profileImage: userProfile?.photoURL || userProfile?.profileImage || "",
                            bannerImage: userProfile?.bannerImage || "",
                            bannerPosition: String((userProfile as any)?.bannerPosition ?? "50"),
                            loopVideoUrl: (userProfile as any)?.loopVideoUrl || "",
                            slug: (userProfile as any)?.slug || "",
                            contactEmail: userProfile?.email || userProfile?.contactEmail || "",
                            contactPhone: userProfile?.phone || userProfile?.contactPhone || "",
                            instagram: userProfile?.instagram || "",
                            twitter: userProfile?.twitter || "",
                            youtube: userProfile?.youtube || "",
                            spotify: userProfile?.spotify || "",
                            pageMode: (artist.pageMode as any) || 'artist',
                          }}
                          onUpdate={() => {
                            setGalleriesRefreshKey(prev => prev + 1);
                            refetchProfile();
                          }}
                          onProductsChanged={() => {
                            refetchProducts();
                          }}
                          onGalleryCreated={() => {
                            logger.info('?? onGalleryCreated callback - Refrescando galer�as...');
                            setGalleriesRefreshKey(prev => prev + 1);
                          }}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-full"
                          style={{
                            backgroundColor: 'transparent',
                            borderColor: colors.hexBorder,
                            color: colors.hexAccent
                          }}
                          onClick={() => setShowLayoutConfig(true)}
                          data-testid="button-edit-layout"
                        >
                          <Layout className="h-4 w-4 mr-2" />
                          Customize Layout
                        </Button>
                        <Button
                          size="sm"
                          className="rounded-full bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 text-white border-0 hover:opacity-90 shadow-lg shadow-purple-500/25"
                          onClick={() => setShowPromoteModal(true)}
                          data-testid="button-promote-page"
                        >
                          <Rocket className="h-4 w-4 mr-2" />
                          Promote My Page
                        </Button>
                        {/* Social Network Toggle */}
                        <Button
                          size="sm"
                          variant={socialNetworkEnabled ? "default" : "outline"}
                          className={`rounded-full transition-all duration-300 ${
                            socialNetworkEnabled
                              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-0 shadow-lg shadow-cyan-500/25 hover:opacity-90'
                              : ''
                          }`}
                          style={!socialNetworkEnabled ? {
                            backgroundColor: 'transparent',
                            borderColor: colors.hexBorder,
                            color: colors.hexAccent
                          } : undefined}
                          onClick={() => {
                            if (socialNetworkEnabled) {
                              setLocation('/social-network');
                            } else {
                              toggleSocialNetwork();
                            }
                          }}
                          data-testid="button-social-network"
                        >
                          <Globe className="h-4 w-4 mr-2" />
                          Social Network
                          <span
                            role="switch"
                            aria-checked={socialNetworkEnabled}
                            className={`ml-2 relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                              socialNetworkEnabled ? 'bg-white/30' : 'bg-gray-600'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSocialNetwork();
                            }}
                          >
                            <span
                              className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${
                                socialNetworkEnabled ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </span>
                        </Button>
                      </>
                    ) : (
                      <>
                        {artist.website && (
                          <a 
                            href={artist.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`${primaryBtn} text-white hover:opacity-80`}
                            style={{ backgroundColor: colors.hexPrimary }}
                            data-testid="button-website"
                          >
                            <ExternalLink className="h-4 w-4 inline mr-2" />
                            Website
                          </a>
                        )}
                        <button 
                          className={`${primaryBtn} bg-black hover:bg-gray-800`}
                          style={{ borderColor: colors.hexBorder, borderWidth: '1px', color: colors.hexAccent }}
                          onClick={handleShare}
                          data-testid="button-share-profile"
                        >
                          Share Profile
                        </button>
                      </>
                    )}
                  </div>

                  {/* How it Works � always visible, own row */}
                  <div className="mt-3 flex justify-center sm:justify-start">
                    <button
                      onClick={() => setShowHowItWorks(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300 hover:scale-105 active:scale-95 hover:shadow-lg"
                      style={{
                        background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(99,102,241,0.15) 100%)',
                        borderColor: 'rgba(139,92,246,0.4)',
                        color: '#a78bfa',
                        boxShadow: '0 0 20px rgba(139,92,246,0.1)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 24px rgba(139,92,246,0.3)')}
                      onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 0 20px rgba(139,92,246,0.1)')}
                    >
                      <Layers className="w-4 h-4" />
                      <span className="text-sm font-semibold">How it Works</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(139,92,246,0.2)', color: '#c4b5fd' }}>
                        Platform Guide
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Promote Modal */}
            <PromoteModal
              open={showPromoteModal}
              onClose={() => setShowPromoteModal(false)}
              artistName={artist.name}
              accentColor={colors.hexAccent}
            />

            {/* How Boostify Works Modal */}
            <HowBoostifyWorks open={showHowItWorks} onOpenChange={setShowHowItWorks} />

            {/* Layout Configuration Modal */}
            <Dialog open={showLayoutConfig} onOpenChange={setShowLayoutConfig}>
              <DialogContent className="w-[calc(100vw-1rem)] sm:w-[95vw] max-w-3xl max-h-[90dvh] sm:max-h-[88vh] overflow-y-auto overflow-x-hidden bg-zinc-900 border-zinc-800 p-3 sm:p-6">
                <DialogHeader className="pr-8">
                  <DialogTitle className="text-base sm:text-2xl font-bold text-white flex items-center gap-2">
                    <Layout className="h-5 w-5 sm:h-6 sm:w-6 flex-shrink-0" style={{ color: colors.hexAccent }} />
                    <span className="truncate">Customize Profile Layout</span>
                  </DialogTitle>
                  <DialogDescription className="text-gray-400 text-xs sm:text-sm">
                    Reorder sections and enable/disable the ones you want to show
                  </DialogDescription>
                </DialogHeader>

                {/* Control Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                  <Button
                    size="sm"
                    onClick={expandAll}
                    className="w-full text-[11px] sm:text-xs h-9 sm:h-8 px-2"
                    style={{
                      backgroundColor: colors.hexPrimary,
                      color: 'white'
                    }}
                    data-testid="button-expand-all"
                  >
                    <ChevronDown className="h-3 w-3 mr-1 flex-shrink-0" />
                    <span className="truncate">Expand</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={collapseAll}
                    variant="outline"
                    className="w-full text-[11px] sm:text-xs h-9 sm:h-8 px-2 border-zinc-700"
                    data-testid="button-collapse-all"
                  >
                    <ChevronRight className="h-3 w-3 mr-1 flex-shrink-0" />
                    <span className="truncate">Collapse</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={activateAll}
                    className="w-full text-[11px] sm:text-xs h-9 sm:h-8 px-2"
                    style={{
                      backgroundColor: colors.hexAccent,
                      color: 'black'
                    }}
                    data-testid="button-activate-all"
                  >
                    <Check className="h-3 w-3 mr-1 flex-shrink-0" />
                    <span className="truncate">All On</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={deactivateAll}
                    variant="outline"
                    className="w-full text-[11px] sm:text-xs h-9 sm:h-8 px-2 border-zinc-700"
                    data-testid="button-deactivate-all"
                  >
                    <X className="h-3 w-3 mr-1 flex-shrink-0" />
                    <span className="truncate">All Off</span>
                  </Button>
                </div>

                {/* Predetermined / ready-made presets — one tap opens a curated module set */}
                <div className="mb-4 rounded-xl border border-zinc-800 bg-black/30 p-3 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Sparkles className="h-4 w-4 flex-shrink-0" style={{ color: colors.hexAccent }} />
                      <h3 className="text-sm font-semibold text-white truncate">Ready-made presets</h3>
                    </div>
                    {/* Combine toggle — merge presets instead of replacing */}
                    <button
                      type="button"
                      onClick={() => setCombinePresets(v => !v)}
                      className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all flex-shrink-0"
                      style={{
                        borderColor: combinePresets ? colors.hexAccent : '#3f3f46',
                        backgroundColor: combinePresets ? `${colors.hexAccent}22` : 'transparent',
                        color: combinePresets ? colors.hexAccent : '#a1a1aa',
                      }}
                      title="When on, presets are added on top of your current layout instead of replacing it"
                      data-testid="button-toggle-combine-presets"
                    >
                      <Layers className="h-3.5 w-3.5" />
                      {combinePresets ? 'Combine: ON' : 'Combine: OFF'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">
                    {combinePresets
                      ? 'Combine mode is on — each preset you tap adds its modules on top of your current layout so you can stack several together.'
                      : 'Ready-made templates that open a set of modules based on what you want to highlight. Tap one to apply it instantly, or turn on Combine to stack them.'}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {PREDETERMINED_LAYOUT_PRESETS.map((preset) => {
                      const PIcon = preset.icon;
                      return (
                        <button
                          key={preset.key}
                          type="button"
                          onClick={() => applyPredeterminedPreset(preset)}
                          className="group flex flex-col items-start gap-1.5 rounded-lg border bg-zinc-950/70 p-2.5 text-left transition-all hover:bg-zinc-900 active:scale-[0.98] min-w-0"
                          style={{ borderColor: `${preset.accent}33` }}
                          data-testid={`button-preset-${preset.key}`}
                        >
                          <span
                            className="flex h-7 w-7 items-center justify-center rounded-md flex-shrink-0"
                            style={{ backgroundColor: `${preset.accent}22`, color: preset.accent }}
                          >
                            <PIcon className="h-4 w-4" />
                          </span>
                          <span className="text-xs font-semibold text-white leading-tight w-full truncate">{preset.label}</span>
                          <span className="text-[10px] text-gray-500 leading-snug">{preset.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mb-4 rounded-xl border border-zinc-800 bg-black/30 p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Bookmark className="h-4 w-4" style={{ color: colors.hexAccent }} />
                    <h3 className="text-sm font-semibold text-white">Saved presets</h3>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">
                    Save profile setups so you can re-open different module combinations whenever you want.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 mb-3">
                    <Input
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          saveCurrentPreset();
                        }
                      }}
                      maxLength={48}
                      placeholder="E.g. Live Showcase, Press, Sales"
                      className="bg-zinc-950 border-zinc-700 text-white"
                    />
                    <Button
                      type="button"
                      onClick={saveCurrentPreset}
                      className="sm:w-auto"
                      style={{ backgroundColor: colors.hexPrimary, color: 'white' }}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save preset
                    </Button>
                  </div>

                  {layoutPresets.length > 0 ? (
                    <div className="space-y-2">
                      {layoutPresets.map((preset) => {
                        const leftModules = Object.values(preset.layout.visibility).filter(Boolean).length;
                        const rightModules = Object.values(preset.layout.rightVisibility).filter(Boolean).length;
                        return (
                          <div
                            key={preset.id}
                            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 text-white text-sm font-medium">
                                <FolderOpen className="h-4 w-4 flex-shrink-0" style={{ color: colors.hexAccent }} />
                                <span className="truncate">{preset.name}</span>
                              </div>
                              <p className="text-[11px] text-gray-400 mt-1">
                                {leftModules} main modules, {rightModules} active widgets
                              </p>
                            </div>
                            <div className="flex gap-2 sm:flex-shrink-0">
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => applyPreset(preset)}
                                className="flex-1 sm:flex-none"
                                style={{ backgroundColor: colors.hexAccent, color: 'black' }}
                              >
                                <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
                                Open
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => deletePreset(preset.id)}
                                className="flex-1 sm:flex-none border-zinc-700 text-zinc-300"
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/40 p-3 text-xs text-gray-500">
                      No saved presets yet.
                    </div>
                  )}
                </div>

                  <Droppable droppableId="layout-config">
                    {(provided) => (
                      <div 
                        ref={provided.innerRef} 
                        {...provided.droppableProps}
                        className="space-y-2 py-4"
                      >
                        {isOwnProfile && (
                          <>
                            <div className="mb-3">
                              <Button
                                size="sm"
                                onClick={() => generateAutoNarrativeBlocks({ force: true })}
                                disabled={isGeneratingAutoBlocks}
                                className="w-full text-xs"
                                style={{
                                  background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
                                  color: 'white'
                                }}
                                data-testid="button-generate-auto-profile-story"
                              >
                                <RefreshCw className={`h-3 w-3 mr-1 ${isGeneratingAutoBlocks ? 'animate-spin' : ''}`} />
                                {isGeneratingAutoBlocks ? 'Generating AI banner + text...' : 'Generate AI banner + text'}
                              </Button>
                            </div>
                            <CustomBlocksAdder accent={colors.hexAccent} onAdd={addCustomBlock} />
                          </>
                        )}
                        {sectionOrder.map((sectionId, index) => {
                          const isCustom = isCustomBlockId(sectionId);
                          const customBlock = isCustom ? customBlocks[sectionId] : undefined;
                          // Custom block whose data was lost (orphan id) � skip silently.
                          if (isCustom && !customBlock) return null;

                          const builtinSection = !isCustom
                            ? allSections[sectionId as keyof typeof allSections]
                            : undefined;
                          if (!isCustom && !builtinSection) return null;

                          // Skip owner-only built-in sections if not owner
                          if (builtinSection?.isOwnerOnly && !isOwnProfile) return null;

                          const Icon = isCustom ? blockIcon((customBlock as CustomBlock).kind) : builtinSection!.icon;
                          const sectionName = isCustom
                            ? `${(customBlock as CustomBlock).kind.charAt(0).toUpperCase() + (customBlock as CustomBlock).kind.slice(1)} � ${blockLabel(customBlock as CustomBlock)}`
                            : builtinSection!.name;
                          const isVisible = sectionVisibility[sectionId];
                          const catMeta = !isCustom ? MODULE_CATEGORY[sectionId] : undefined;
                          
                          return (
                            <Draggable key={sectionId} draggableId={sectionId} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`p-2.5 sm:p-4 rounded-lg border transition-all overflow-hidden ${
                                    snapshot.isDragging ? 'shadow-lg' : ''
                                  }`}
                                  style={{
                                    ...provided.draggableProps.style,
                                    backgroundColor: isVisible ? `${colors.hexPrimary}20` : '#18181b',
                                    borderColor: isVisible ? colors.hexBorder : '#27272a'
                                  }}
                                >
                                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-2 gap-y-2 min-w-0">
                                    {/* Identity: full row on mobile, grows on desktop */}
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1 basis-full sm:basis-0">
                                      <div 
                                        {...provided.dragHandleProps}
                                        className="cursor-grab active:cursor-grabbing flex-shrink-0"
                                      >
                                        <GripVertical className="h-4 w-4 text-gray-400" />
                                      </div>

                                      {/* Move up/down buttons */}
                                      <div className="flex flex-col gap-0.5 flex-shrink-0">
                                        <button
                                          onClick={() => moveSection(sectionId, 'up')}
                                          disabled={index === 0}
                                          className="p-0.5 rounded hover:bg-white/10 disabled:opacity-20 transition-opacity"
                                        >
                                          <ArrowUp className="h-3 w-3 text-gray-400" />
                                        </button>
                                        <button
                                          onClick={() => moveSection(sectionId, 'down')}
                                          disabled={index === sectionOrder.length - 1}
                                          className="p-0.5 rounded hover:bg-white/10 disabled:opacity-20 transition-opacity"
                                        >
                                          <ArrowDown className="h-3 w-3 text-gray-400" />
                                        </button>
                                      </div>
                                      
                                      <Icon 
                                        className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" 
                                        style={{ color: isVisible ? colors.hexAccent : '#71717a' }}
                                      />
                                      
                                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                        <span 
                                          className="font-medium text-xs sm:text-sm truncate"
                                          style={{ color: isVisible ? 'white' : '#71717a' }}
                                        >
                                          {sectionName}
                                        </span>
                                        {catMeta && (
                                          <span
                                            className="text-[9px] sm:text-[10px] font-semibold px-1.5 py-0.5 rounded-full w-fit"
                                            style={{ backgroundColor: `${catMeta.color}22`, color: catMeta.color }}
                                          >
                                            {catMeta.label}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Action cluster — grouped & always visible (never clipped) */}
                                    <div className="flex items-center gap-0.5 flex-shrink-0 ml-auto rounded-lg bg-black/40 border border-white/5 p-0.5">
                                      {isCustom && isOwnProfile && (
                                        <>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setEditingBlockId(sectionId)}
                                            className="h-7 w-7 p-0 flex-shrink-0"
                                            title="Edit block"
                                          >
                                            <Pencil className="h-3.5 w-3.5 text-gray-400" />
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                              if (window.confirm('Delete this custom block?')) deleteCustomBlock(sectionId);
                                            }}
                                            className="h-7 w-7 p-0 flex-shrink-0"
                                            title="Delete block"
                                          >
                                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                                          </Button>
                                        </>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setModuleSide(sectionId, sideOf(sectionId) === 'right' ? 'left' : 'right')}
                                        className="h-7 w-7 p-0 flex-shrink-0"
                                        title={sideOf(sectionId) === 'right' ? 'Move to left column' : 'Move to right column'}
                                        data-testid={`button-toggle-side-${sectionId}`}
                                      >
                                        {sideOf(sectionId) === 'right' ? (
                                          <ArrowLeft className="h-3.5 w-3.5" style={{ color: colors.hexAccent }} />
                                        ) : (
                                          <ArrowRight className="h-3.5 w-3.5 text-gray-400" />
                                        )}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          setSectionExpanded(prev => ({
                                            ...prev,
                                            [sectionId]: !prev[sectionId]
                                          }));
                                        }}
                                        className="h-7 w-7 p-0 flex-shrink-0"
                                        data-testid={`button-toggle-expand-${sectionId}`}
                                      >
                                        {sectionExpanded[sectionId] ? (
                                          <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                                        ) : (
                                          <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                                        )}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          setSectionVisibility(prev => ({
                                            ...prev,
                                            [sectionId]: !prev[sectionId]
                                          }));
                                        }}
                                        className="h-7 w-7 p-0 flex-shrink-0 rounded-md"
                                        style={{ backgroundColor: isVisible ? `${colors.hexAccent}22` : 'rgba(244,63,94,0.12)' }}
                                        title={isVisible ? 'Hide section' : 'Show section'}
                                        data-testid={`button-toggle-visible-${sectionId}`}
                                      >
                                        {isVisible ? (
                                          <Eye className="h-3.5 w-3.5" style={{ color: colors.hexAccent }} />
                                        ) : (
                                          <EyeOff className="h-3.5 w-3.5 text-gray-500" />
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>

                {/* Column placement helper � distribute modules across both columns */}
                <div className="mt-6 pt-4 border-t border-zinc-700">
                  <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                    <Layout className="h-4 w-4" style={{ color: colors.hexAccent }} />
                    Columns (Desktop)
                  </h3>
                  <p className="text-xs text-gray-400 mb-3">
                    Use each module's ◀ ▶ arrows to send it to the left or right column and fill the empty gaps on large screens.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      onClick={autoBalanceColumns}
                      className="w-full text-xs justify-center"
                      style={{ backgroundColor: colors.hexPrimary, color: 'white', border: `1px solid ${colors.hexBorder}` }}
                    >
                      <Sparkles className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="truncate">Auto-balance columns</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setSideOverride({})}
                      className="w-full text-xs justify-center"
                      style={{ backgroundColor: '#18181b', color: '#a1a1aa', border: '1px solid #27272a' }}
                    >
                      <X className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="truncate">Reset columns</span>
                    </Button>
                  </div>
                </div>

                {/* Right Column Widgets Section � drag/up-down/visibility */}
                <div className="mt-6 pt-4 border-t border-zinc-700">
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <Layers className="h-4 w-4" style={{ color: colors.hexAccent }} />
                    Right Column Widgets
                  </h3>
                  <Droppable droppableId="layout-config-right">
                    {(rcProvided) => (
                      <div ref={rcProvided.innerRef} {...rcProvided.droppableProps} className="space-y-2">
                        {rightOrder.map((widgetId, rIndex) => {
                          const widget = rightWidgets[widgetId];
                          if (!widget) return null;
                          const isVisible = rightVisibility[widgetId] !== false;
                          const Icon = widget.icon;
                          return (
                            <Draggable key={widgetId} draggableId={`rc-${widgetId}`} index={rIndex}>
                              {(rcDrag, rcSnap) => (
                                <div
                                  ref={rcDrag.innerRef}
                                  {...rcDrag.draggableProps}
                                  className={`p-2.5 sm:p-3 rounded-lg border transition-all overflow-hidden ${rcSnap.isDragging ? 'shadow-lg' : ''}`}
                                  style={{
                                    ...rcDrag.draggableProps.style,
                                    backgroundColor: isVisible ? `${colors.hexPrimary}20` : '#18181b',
                                    borderColor: isVisible ? colors.hexBorder : '#27272a',
                                  }}
                                >
                                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-2 gap-y-2 min-w-0">
                                    {/* Identity: full row on mobile, grows on desktop */}
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1 basis-full sm:basis-0">
                                      <div {...rcDrag.dragHandleProps} className="cursor-grab active:cursor-grabbing flex-shrink-0">
                                        <GripVertical className="h-4 w-4 text-gray-400" />
                                      </div>
                                      <div className="flex flex-col gap-0.5 flex-shrink-0">
                                        <button
                                          onClick={() => moveRightWidget(widgetId, 'up')}
                                          disabled={rIndex === 0}
                                          className="p-0.5 rounded hover:bg-white/10 disabled:opacity-20 transition-opacity"
                                        >
                                          <ArrowUp className="h-3 w-3 text-gray-400" />
                                        </button>
                                        <button
                                          onClick={() => moveRightWidget(widgetId, 'down')}
                                          disabled={rIndex === rightOrder.length - 1}
                                          className="p-0.5 rounded hover:bg-white/10 disabled:opacity-20 transition-opacity"
                                        >
                                          <ArrowDown className="h-3 w-3 text-gray-400" />
                                        </button>
                                      </div>
                                      {Icon && <Icon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" style={{ color: isVisible ? colors.hexAccent : '#71717a' }} />}
                                      <span
                                        className="flex-1 min-w-0 font-medium text-xs sm:text-sm truncate"
                                        style={{ color: isVisible ? 'white' : '#71717a' }}
                                      >
                                        {widget.name}
                                      </span>
                                    </div>

                                    {/* Action cluster — grouped & always visible (never clipped) */}
                                    <div className="flex items-center gap-0.5 flex-shrink-0 ml-auto rounded-lg bg-black/40 border border-white/5 p-0.5">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setModuleSide(widgetId, sideOf(widgetId) === 'left' ? 'right' : 'left')}
                                        className="h-7 w-7 p-0 flex-shrink-0"
                                        title={sideOf(widgetId) === 'left' ? 'Move to right column' : 'Move to left column'}
                                        data-testid={`button-toggle-side-${widgetId}`}
                                      >
                                        {sideOf(widgetId) === 'left' ? (
                                          <ArrowRight className="h-3.5 w-3.5" style={{ color: colors.hexAccent }} />
                                        ) : (
                                          <ArrowLeft className="h-3.5 w-3.5 text-gray-400" />
                                        )}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          setRightVisibility(prev => ({
                                            ...prev,
                                            [widgetId]: !prev[widgetId],
                                          }));
                                        }}
                                        className="h-7 w-7 p-0 flex-shrink-0 rounded-md"
                                        style={{ backgroundColor: isVisible ? `${colors.hexAccent}22` : 'rgba(244,63,94,0.12)' }}
                                        title={isVisible ? 'Hide widget' : 'Show widget'}
                                        data-testid={`button-toggle-visible-${widgetId}`}
                                      >
                                        {isVisible ? (
                                          <Eye className="h-3.5 w-3.5" style={{ color: colors.hexAccent }} />
                                        ) : (
                                          <EyeOff className="h-3.5 w-3.5 text-gray-500" />
                                        )}
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {rcProvided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>

                {/* Mobile layout � choose which column appears first when collapsed to one column */}
                <div className="mt-6 pt-4 border-t border-zinc-700">
                  <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
                    <Layout className="h-4 w-4" style={{ color: colors.hexAccent }} />
                    Mobile Layout
                  </h3>
                  <p className="text-xs text-gray-400 mb-3">
                    Pick which column shows on top when the profile collapses to one column on phones.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      onClick={() => setMobileColumnFirst('left')}
                      className="w-full text-xs justify-center"
                      style={{
                        backgroundColor: mobileColumnFirst === 'left' ? colors.hexPrimary : '#18181b',
                        color: mobileColumnFirst === 'left' ? 'white' : '#a1a1aa',
                        border: `1px solid ${mobileColumnFirst === 'left' ? colors.hexBorder : '#27272a'}`,
                      }}
                    >
                      <ArrowUp className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="truncate">Main content first</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setMobileColumnFirst('right')}
                      className="w-full text-xs justify-center"
                      style={{
                        backgroundColor: mobileColumnFirst === 'right' ? colors.hexPrimary : '#18181b',
                        color: mobileColumnFirst === 'right' ? 'white' : '#a1a1aa',
                        border: `1px solid ${mobileColumnFirst === 'right' ? colors.hexBorder : '#27272a'}`,
                      }}
                    >
                      <Layers className="h-3 w-3 mr-1 flex-shrink-0" />
                      <span className="truncate">Widgets first</span>
                    </Button>
                  </div>
                </div>

                <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 mt-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowLayoutConfig(false)}
                    className="w-full sm:w-auto border-zinc-700 text-white hover:bg-zinc-800"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={saveLayout}
                    className="w-full sm:w-auto gap-2"
                    style={{
                      background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
                      color: 'white'
                    }}
                  >
                    <Save className="h-4 w-4" />
                    Save Layout
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* CTA for non-authenticated visitors - Between bio and music */}
            {!isOwnProfile && !user && (
              <div className={cardStyles} style={cardStyleInline}>
                <div className="text-center py-8">
                  <div className="mb-4">
                    <Sparkles className="h-12 w-12 mx-auto mb-3" style={{ color: colors.hexAccent }} />
                    <h3 className="text-2xl font-bold text-white mb-2">Are you a musician?</h3>
                    <p className="text-gray-400">
                      Create your professional artist profile for free and reach more fans
                    </p>
                  </div>
                  <Link href="/auth">
                    <Button
                      className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg gap-2 px-6 py-6 text-base font-bold rounded-full hover:scale-105 transition-all duration-300"
                      data-testid="button-cta-middle"
                    >
                      <Sparkles className="h-5 w-5" />
                      Create My Free Profile
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* Owner quick action: generate/update AI narrative blocks directly from the module area */}
            {isOwnProfile && (
              <div
                className="rounded-2xl p-5 shadow-lg overflow-hidden relative"
                style={{
                  background: `linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.5) 100%)`,
                  border: `1px solid ${colors.hexAccent}55`,
                  boxShadow: `0 0 24px ${colors.hexAccent}22, inset 0 1px 0 ${colors.hexAccent}33`,
                  backdropFilter: 'blur(16px)',
                }}
              >
                {/* subtle glow blob */}
                <div
                  className="absolute -top-8 -right-8 w-32 h-32 rounded-full pointer-events-none"
                  style={{ background: `radial-gradient(circle, ${colors.hexAccent}33 0%, transparent 70%)` }}
                />
                <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, ${colors.hexPrimary}33, ${colors.hexAccent}33)`, border: `1px solid ${colors.hexAccent}55` }}
                    >
                      <Sparkles className="h-4 w-4" style={{ color: colors.hexAccent }} />
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-sm font-bold"
                        style={{
                          background: `linear-gradient(90deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                        }}
                      >
                        AI Narrative Blocks
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Create or refresh your automatic banner + story text directly on your profile.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => generateAutoNarrativeBlocks({ force: true })}
                    disabled={isGeneratingAutoBlocks}
                    className="text-xs w-full sm:w-auto flex-shrink-0 font-semibold"
                    style={{
                      background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
                      color: 'white',
                      boxShadow: `0 2px 12px ${colors.hexAccent}44`,
                    }}
                    data-testid="button-generate-auto-profile-story-inline"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isGeneratingAutoBlocks ? 'animate-spin' : ''}`} />
                    {isGeneratingAutoBlocks ? 'Generating AI text + banner...' : 'Generate AI text + banner'}
                  </Button>
                </div>
              </div>
            )}

            {/* Render all sections based on order and visibility */}
              <Droppable droppableId="inline-sections" isDropDisabled={!isOwnProfile || tierLimits.isFree}>
                {(droppableProvided) => (
                  <div
                    ref={droppableProvided.innerRef}
                    {...droppableProvided.droppableProps}
                    className="flex flex-col gap-4"
                  >
              {(() => {
              const renderSectionCard = (sectionId: string, filteredIndex: number, isStatic: boolean = false): React.ReactNode => {
                let sectionElement = null;

                // --- Custom user-defined block (text / separator / banner / section) ---
                if (isCustomBlockId(sectionId)) {
                  const block = customBlocks[sectionId];
                  if (!block) return null;
                  sectionElement = (
                    <CustomBlockRenderer
                      block={block}
                      accent={colors.hexAccent}
                      cardStyles={block.kind === 'separator' || block.kind === 'banner' ? undefined : cardStyles}
                      cardStyleInline={block.kind === 'separator' || block.kind === 'banner' ? undefined : cardStyleInline}
                    />
                  );
                }
                      
                      if (sectionId === 'fanclub') {
                        sectionElement = (
                          <div className={cardStyles} style={cardStyleInline}>
                            {renderSectionHeader(sectionId, Heart, 'Fan Club')}
                            {sectionExpanded[sectionId] && (
                              <FanClubPanel
                                artistId={Number(artist.pgId || artistId)}
                                artistName={artist.name}
                                artistSlug={((artist as any) || {})['slug'] as string | undefined}
                                colors={colors}
                                isOwner={!!isOwnProfile}
                              />
                            )}
                          </div>
                        );
                      }

                      if (sectionId === 'live-stage') {
                        sectionElement = (
                          <div className={cardStyles} style={cardStyleInline}>
                            {renderSectionHeader(sectionId, Radio, 'Boostify Live Stage')}
                            {sectionExpanded[sectionId] && (
                              <div className="mt-3">
                                <BoostifyLiveStage
                                  artistId={artist.pgId || artistId}
                                  artistName={artist.name}
                                  artistSlug={((artist as any) || {})['slug'] as string | undefined}
                                  artistAvatar={artist.profileImage}
                                  colors={{ primary: colors.hexPrimary, secondary: colors.hexAccent, accent: colors.hexAccent }}
                                  isOwner={!!isOwnProfile}
                                />
                              </div>
                            )}
                          </div>
                        );
                      }

                      if (sectionId === 'songs' && (songs.length > 0 || isOwnProfile)) {
                        sectionElement = (
            <div id="music" className={cardStyles} style={cardStyleInline}>
                {renderSectionHeader(sectionId, Music, t('profile.sections.music'), songs.length,
                  isOwnProfile ? (
                    <>
                      <UploadLimitBanner current={songs.length} max={tierLimits.limits.songs} type="songs" accentColor={colors.hexAccent} />
                      <Dialog open={showUploadSongDialog} onOpenChange={setShowUploadSongDialog}>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            className="rounded-full"
                            style={{ backgroundColor: tierLimits.canUploadSong(songs.length) ? colors.hexPrimary : '#555', color: 'white' }}
                            data-testid="button-upload-song"
                            disabled={!tierLimits.canUploadSong(songs.length)}
                            title={!tierLimits.canUploadSong(songs.length) ? `Song limit reached (${tierLimits.limits.songs})` : undefined}
                          >
                            {!tierLimits.canUploadSong(songs.length) ? <Lock className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                            Upload Songs
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Upload Songs</DialogTitle>
                          <DialogDescription>
                            Drop one or many audio files. Titles default to the filename (without extension) — edit them inline before uploading.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="song-files">Audio files</Label>
                            <Input
                              id="song-files"
                              type="file"
                              accept="audio/*"
                              multiple
                              ref={songFileInputRef}
                              onChange={handleSongFilesSelected}
                              disabled={isUploadingSong}
                              data-testid="input-song-files"
                            />
                            <p className="text-[11px] text-white/50">
                              You can pick multiple files at once. Hold Ctrl/Cmd or Shift to select several. Click the image thumbnail on each row to add a cover.
                            </p>
                          </div>

                          {/* Default album applied to every queued row */}
                          <div className="space-y-2">
                            <Label htmlFor="bulk-album-default">Album (optional, applied to all)</Label>
                            <Input
                              id="bulk-album-default"
                              value={bulkAlbumDefault}
                              onChange={(e) => setBulkAlbumDefault(e.target.value)}
                              placeholder="e.g. Midnight Sessions Vol. 1"
                              disabled={isUploadingSong}
                              className="h-9 text-sm"
                              data-testid="input-bulk-album-default"
                            />
                            <p className="text-[11px] text-white/50">
                              Leave empty to upload as singles. You can override per-track below.
                            </p>
                          </div>

                          {bulkSongQueue.length > 0 && (
                            <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                              {bulkSongQueue.map((item, idx) => (
                                <div
                                  key={item.id}
                                  className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex flex-col gap-2"
                                  data-testid={`bulk-song-row-${idx}`}
                                >
                                  <div className="flex items-center gap-2">
                                    {/* Cover art thumbnail / picker */}
                                    <label
                                      className="flex-shrink-0 relative w-9 h-9 rounded-md overflow-hidden cursor-pointer group"
                                      style={{ backgroundColor: `${colors.hexAccent}1f`, border: `1px dashed ${colors.hexAccent}55` }}
                                      title="Click to pick cover art"
                                    >
                                      {item.coverArtPreview ? (
                                        <img
                                          src={item.coverArtPreview}
                                          alt="cover"
                                          loading="lazy"
                                          decoding="async"
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center" style={{ color: colors.hexAccent }}>
                                          <Image className="h-3.5 w-3.5" />
                                        </div>
                                      )}
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <Image className="h-3 w-3 text-white" />
                                      </div>
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="sr-only"
                                        disabled={item.status === 'uploading' || item.status === 'done'}
                                        onChange={(e) => {
                                          const f = e.target.files?.[0];
                                          if (!f) return;
                                          const preview = URL.createObjectURL(f);
                                          setBulkSongQueue(prev => prev.map(q => q.id === item.id ? { ...q, coverArt: f, coverArtPreview: preview } : q));
                                          e.target.value = '';
                                        }}
                                        data-testid={`input-bulk-cover-${idx}`}
                                      />
                                    </label>
                                    <Input
                                      value={item.title}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        setBulkSongQueue(prev => prev.map(q => q.id === item.id ? { ...q, title: v } : q));
                                      }}
                                      placeholder={stripAudioExt(item.file.name) || 'Untitled'}
                                      disabled={item.status === 'uploading' || item.status === 'done'}
                                      className="flex-1 h-9 text-sm"
                                      data-testid={`input-bulk-title-${idx}`}
                                    />
                                    <Input
                                      value={item.album ?? ''}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        setBulkSongQueue(prev => prev.map(q => q.id === item.id ? { ...q, album: v } : q));
                                      }}
                                      placeholder={bulkAlbumDefault || 'Album (optional)'}
                                      disabled={item.status === 'uploading' || item.status === 'done'}
                                      className="w-40 h-9 text-sm hidden sm:block"
                                      data-testid={`input-bulk-album-${idx}`}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (item.status === 'uploading') return;
                                        if (item.coverArtPreview) URL.revokeObjectURL(item.coverArtPreview);
                                        setBulkSongQueue(prev => prev.filter(q => q.id !== item.id));
                                      }}
                                      className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30"
                                      disabled={item.status === 'uploading'}
                                      title="Remove"
                                      data-testid={`button-remove-bulk-${idx}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                  <div className="flex items-center justify-between gap-3 text-[11px]">
                                    <span className="text-white/40 truncate">
                                      {item.file.name} — {(item.file.size / (1024 * 1024)).toFixed(2)} MB
                                    </span>
                                    <span
                                      className="font-medium"
                                      style={{
                                        color:
                                          item.status === 'done' ? '#34d399' :
                                          item.status === 'error' ? '#f87171' :
                                          item.status === 'uploading' ? colors.hexAccent :
                                          '#a1a1aa',
                                      }}
                                    >
                                      {item.status === 'pending' && 'Ready'}
                                      {item.status === 'uploading' && `${item.progress}%`}
                                      {item.status === 'done' && '? Uploaded'}
                                      {item.status === 'error' && (item.error || 'Failed')}
                                    </span>
                                  </div>
                                  {item.status === 'uploading' && (
                                    <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                                      <div
                                        className="h-1.5 rounded-full transition-all duration-300"
                                        style={{
                                          width: `${item.progress}%`,
                                          background: `linear-gradient(90deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <DialogFooter className="gap-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              if (isUploadingSong) return;
                              setShowUploadSongDialog(false);
                              setSongUploadProgress(0);
                              setBulkSongQueue([]);
                              setBulkAlbumDefault("");
                            }}
                            disabled={isUploadingSong}
                            data-testid="button-cancel-bulk-upload"
                          >
                            Close
                          </Button>
                          <Button
                            onClick={handleBulkUploadSongs}
                            disabled={isUploadingSong || bulkSongQueue.filter(i => i.status === 'pending' || i.status === 'error').length === 0}
                            style={{
                              background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
                              color: 'white',
                            }}
                            data-testid="button-start-bulk-upload"
                          >
                            {isUploadingSong ? 'Uploading...' : `Upload ${bulkSongQueue.filter(i => i.status === 'pending' || i.status === 'error').length || ''}`.trim()}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    
                    {/* Bot�n para generar canci�n con IA */}
                    <Button
                      size="sm"
                      className="rounded-full"
                      style={{ 
                        background: tierLimits.canUploadSong(songs.length)
                          ? `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`
                          : '#555',
                        color: 'white' 
                      }}
                      onClick={() => { setShowGenerateAISongDialog(true); loadMusicStyleContext(); }}
                      disabled={!tierLimits.canUploadSong(songs.length)}
                      data-testid="button-generate-ai-song"
                    >
                      <Sparkles className="h-4 w-4 mr-1" />
                      Generate AI
                    </Button>

                    {/* Manage Songs button � reorder + rename */}
                    {songs.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        style={{ borderColor: colors.hexBorder, color: colors.hexAccent, background: 'transparent' }}
                        onClick={() => {
                          setManageSongsList(sortSongsSinglesFirst(songs).map((s) => ({ id: s.id, title: s.title || (s as any).name || '', coverArt: s.coverArt })));
                          setShowManageSongsDialog(true);
                        }}
                        data-testid="button-manage-songs"
                      >
                        <GripVertical className="h-4 w-4 mr-1" />
                        Manage
                      </Button>
                    )}

                    {/* Dialog para generar canci�n con IA */}
                    <Dialog open={showGenerateAISongDialog} onOpenChange={setShowGenerateAISongDialog}>
                      <DialogContent className="bg-gray-900 border-gray-800 max-w-lg">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2 text-white">
                            <Sparkles className="h-5 w-5" style={{ color: colors.hexAccent }} />
                            Generate AI Song
                          </DialogTitle>
                          <DialogDescription>
                            AI will compose a track adapted to {artist?.name || 'your'}'s musical style.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                          {/* -- Style Source Banner -- */}
                          {isFetchingStyle ? (
                            <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-800 rounded-lg p-3">
                              <div className="animate-spin h-3.5 w-3.5 border-2 border-t-transparent rounded-full" style={{ borderColor: colors.hexAccent, borderTopColor: 'transparent' }} />
                              Detecting artist style...
                            </div>
                          ) : styleSource === 'blueprint' && blueprintStyle ? (
                            <div className="rounded-lg border p-3 space-y-2" style={{ borderColor: colors.hexBorder, background: 'rgba(255,255,255,0.03)' }}>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.hexAccent }}>
                                  ?? Style from Superstar Blueprint
                                </span>
                                <button
                                  type="button"
                                  className="text-xs text-gray-500 hover:text-white underline"
                                  onClick={() => setStyleSource('manual')}
                                >
                                  Edit manually
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-300">
                                {blueprintStyle.primaryGenre && (
                                  <span><span className="text-gray-500">Genre:</span> {blueprintStyle.primaryGenre}</span>
                                )}
                                {blueprintStyle.vocalStyle && (
                                  <span className="col-span-2"><span className="text-gray-500">Vocal:</span> {blueprintStyle.vocalStyle.substring(0, 60)}</span>
                                )}
                                {blueprintStyle.moodKeywords?.length ? (
                                  <span className="col-span-2"><span className="text-gray-500">Moods:</span> {blueprintStyle.moodKeywords.slice(0, 4).join(', ')}</span>
                                ) : null}
                                {blueprintStyle.influences?.length ? (
                                  <span className="col-span-2"><span className="text-gray-500">Influences:</span> {blueprintStyle.influences.slice(0, 3).join(', ')}</span>
                                ) : null}
                              </div>
                            </div>
                          ) : styleSource === 'songs' ? (
                            <div className="rounded-lg border p-3 space-y-1" style={{ borderColor: colors.hexBorder, background: 'rgba(255,255,255,0.03)' }}>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.hexAccent }}>
                                  ?? Style from Existing Songs
                                </span>
                                <button
                                  type="button"
                                  className="text-xs text-gray-500 hover:text-white underline"
                                  onClick={() => setStyleSource('manual')}
                                >
                                  Edit manually
                                </button>
                              </div>
                              <p className="text-xs text-gray-400">
                                Genre: <span className="text-white">{artist?.genre || songs[0]?.genre || 'pop'}</span>. Generate your{' '}
                                <span className="text-purple-400 cursor-pointer underline" onClick={() => setShowGenerateAISongDialog(false)}>
                                  Superstar Blueprint
                                </span>{' '}
                                for a deeper style profile.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label className="text-white text-xs font-semibold uppercase tracking-wide">?? Manual Style</Label>
                                {(blueprintStyle || songs.length > 0) && (
                                  <button
                                    type="button"
                                    className="text-xs text-gray-500 hover:text-white underline"
                                    onClick={() => setStyleSource(blueprintStyle ? 'blueprint' : 'songs')}
                                  >
                                    Use auto-detected style
                                  </button>
                                )}
                              </div>
                              <textarea
                                value={manualMusicStyle}
                                onChange={(e) => setManualMusicStyle(e.target.value)}
                                placeholder="Describe the musical style (e.g. dark trap with melodic hooks and deep 808s, influenced by The Weeknd and Travis Scott)"
                                className="w-full h-20 p-2 rounded-md bg-gray-800 border border-gray-700 text-white placeholder:text-gray-500 text-sm resize-none"
                                disabled={isGeneratingAISong}
                              />
                            </div>
                          )}

                          {/* -- Song Title -- */}
                          <div className="space-y-1.5">
                            <Label htmlFor="ai-song-title" className="text-white">
                              Song Title <span className="text-gray-500 text-sm font-normal">(optional)</span>
                            </Label>
                            <Input
                              id="ai-song-title"
                              value={aiSongPrompt}
                              onChange={(e) => setAiSongPrompt(e.target.value)}
                              placeholder="Leave empty for AI-generated title"
                              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                              disabled={isGeneratingAISong}
                            />
                            <p className="text-xs text-gray-500">
                              ?? If empty, AI will create a creative title based on the artist's genre and mood
                            </p>
                          </div>

                          {/* -- Mood selector -- */}
                          <div className="space-y-1.5">
                            <Label htmlFor="ai-song-mood" className="text-white">Mood / Energy</Label>
                            <select
                              id="ai-song-mood"
                              value={aiSongMood}
                              onChange={(e) => setAiSongMood(e.target.value as any)}
                              className="w-full p-2 rounded-md bg-gray-800 border border-gray-700 text-white"
                              disabled={isGeneratingAISong}
                            >
                              <option value="energetic">?? Energetic</option>
                              <option value="mellow">?? Mellow</option>
                              <option value="upbeat">?? Upbeat</option>
                              <option value="dark">?? Dark</option>
                              <option value="romantic">?? Romantic</option>
                            </select>
                          </div>
                          
                          {isGeneratingAISong && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                                <div className="animate-spin h-4 w-4 border-2 border-t-transparent rounded-full" style={{ borderColor: colors.hexAccent, borderTopColor: 'transparent' }} />
                                <span>Generating song with AI... (~20-30 seconds)</span>
                              </div>
                              <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                                <div 
                                  className="h-2 rounded-full animate-pulse"
                                  style={{ 
                                    width: '100%',
                                    background: `linear-gradient(90deg, ${colors.hexPrimary}, ${colors.hexAccent})`
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        <DialogFooter className="gap-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setShowGenerateAISongDialog(false);
                              setAiSongPrompt('');
                            }}
                            disabled={isGeneratingAISong}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleGenerateAISong}
                            disabled={isGeneratingAISong}
                            style={{ 
                              background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
                              color: 'white' 
                            }}
                          >
                            {isGeneratingAISong ? (
                              <>
                                <div className="animate-spin h-4 w-4 border-2 border-t-transparent rounded-full mr-2" style={{ borderColor: 'white', borderTopColor: 'transparent' }} />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4 mr-2" />
                                {aiSongPrompt.trim() ? 'Generate Song' : 'Generate Random Song'}
                              </>
                            )}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {/* Manage Songs Dialog � reorder + rename */}
                    <Dialog open={showManageSongsDialog} onOpenChange={setShowManageSongsDialog}>
                      <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <GripVertical className="h-5 w-5" style={{ color: colors.hexAccent }} />
                            Manage Songs
                          </DialogTitle>
                          <DialogDescription>
                            Drag to reorder. Click a title to rename it.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-2 max-h-[60vh] overflow-y-auto space-y-1.5 pr-1">
                          <DragDropContext
                            onDragEnd={(result: any) => {
                              if (!result.destination) return;
                              const src = result.source.index;
                              const dst = result.destination.index;
                              if (src === dst) return;
                              setManageSongsList((prev) => {
                                const next = [...prev];
                                const [moved] = next.splice(src, 1);
                                next.splice(dst, 0, moved);
                                return next;
                              });
                            }}
                          >
                            <Droppable droppableId="manage-songs-list">
                              {(provided: any) => (
                                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1.5">
                                  {manageSongsList.map((item, index) => (
                                    <Draggable key={String(item.id)} draggableId={String(item.id)} index={index}>
                                      {(drag: any) => (
                                        <div
                                          ref={drag.innerRef}
                                          {...drag.draggableProps}
                                          className="flex items-center gap-3 p-2.5 rounded-xl border border-white/10 bg-white/[0.03]"
                                        >
                                          <span
                                            {...drag.dragHandleProps}
                                            className="flex-shrink-0 cursor-grab active:cursor-grabbing text-white/30 hover:text-white/60"
                                            title="Drag to reorder"
                                          >
                                            <GripVertical className="h-4 w-4" />
                                          </span>
                                          {item.coverArt ? (
                                            <img
                                              src={item.coverArt}
                                              alt=""
                                              loading="lazy"
                                              decoding="async"
                                              className="w-9 h-9 rounded-md object-cover flex-shrink-0"
                                            />
                                          ) : (
                                            <div
                                              className="w-9 h-9 rounded-md flex-shrink-0 flex items-center justify-center"
                                              style={{ backgroundColor: `${colors.hexPrimary}33` }}
                                            >
                                              <Music className="h-4 w-4" style={{ color: colors.hexAccent }} />
                                            </div>
                                          )}
                                          <input
                                            value={item.title}
                                            onChange={(e) => {
                                              const v = e.target.value;
                                              setManageSongsList((prev) =>
                                                prev.map((x) => (x.id === item.id ? { ...x, title: v } : x))
                                              );
                                            }}
                                            className="flex-1 min-w-0 bg-transparent border-b border-white/10 outline-none text-sm text-white placeholder:text-white/30 focus:border-white/40 px-1 py-0.5 transition-colors"
                                            placeholder="Song title"
                                          />
                                          <span className="flex-shrink-0 text-xs text-white/30 tabular-nums">#{index + 1}</span>
                                        </div>
                                      )}
                                    </Draggable>
                                  ))}
                                  {provided.placeholder}
                                </div>
                              )}
                            </Droppable>
                          </DragDropContext>
                        </div>
                        <DialogFooter className="gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setShowManageSongsDialog(false)}
                            disabled={isSavingManage}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleSaveManageSongs}
                            disabled={isSavingManage}
                            style={{ background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`, color: 'white' }}
                          >
                            {isSavingManage ? (
                              <><span className="animate-spin mr-2 inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />Saving...</>
                            ) : 'Save changes'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    </>
                  ) : undefined
                )}
                
                {sectionExpanded[sectionId] && (
                <div className="space-y-3">
                  {/* Fan monetization banner */}
                  {songs.length > 0 && (
                    accessData?.unlocked ? (
                      <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold bg-green-500/10 border border-green-500/30 text-green-300">
                        <Sparkles className="h-3.5 w-3.5" />
                        {accessData?.subscriptionActive
                          ? "Monthly membership active · full catalog access enabled."
                          : "Catalog unlocked · full lifetime access. Thanks for supporting!"}
                      </div>
                    ) : !hasFullAccess ? (
                      <button
                        type="button"
                        onClick={() => setUnlockModalOpen(true)}
                        className="w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition-all hover:scale-[1.01] border"
                        style={{
                          background: `linear-gradient(135deg, ${colors.hexPrimary}22, ${colors.hexAccent}22)`,
                          borderColor: `${colors.hexAccent}55`,
                        }}
                        data-testid="button-unlock-catalog"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <Lock className="h-4 w-4 flex-shrink-0" style={{ color: colors.hexAccent }} />
                          <span className="min-w-0">
                            <span className="block text-sm font-bold text-white truncate">
                              Unlock the full catalog
                            </span>
                            <span className="block text-[11px] text-white/60 truncate">
                              {previewSeconds}s free preview · lifetime from $5 · monthly $20
                            </span>
                          </span>
                        </span>
                        <span
                          className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold text-white"
                          style={{ background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})` }}
                        >
                          From $5 / $20mo
                        </span>
                      </button>
                    ) : null
                  )}
                  {(() => {
                    const ordered = sortSongsSinglesFirst(songs);
                    // Collect every album label that's actually in use so the
                    // pill switcher only shows real groups (no empty buckets).
                    const albumSet = new Set<string>();
                    for (const s of ordered) {
                      const a = ((s as any).album || '').trim();
                      if (a) albumSet.add(a);
                    }
                    const albums = Array.from(albumSet).sort((a, b) => a.localeCompare(b));
                    const filteredAll = activeAlbum
                      ? ordered.filter((s) => ((s as any).album || '').trim() === activeAlbum)
                      : ordered;
                    const heroSong = filteredAll[0];
                    const restSongs = filteredAll.slice(1);
                    if (!heroSong) {
                      // The active album was emptied � fall back to "All" instead
                      // of rendering nothing.
                      if (activeAlbum && ordered.length > 0) {
                        return (
                          <div className="text-center text-white/50 py-6 text-sm">
                            No songs in "{activeAlbum}".{' '}
                            <button
                              type="button"
                              onClick={() => setActiveAlbum('')}
                              className="underline hover:text-white"
                            >
                              Show all
                            </button>
                          </div>
                        );
                      }
                      return null;
                    }
                    const isHeroPlaying = playingSongId === heroSong.id;
                    return (
                      <>
                        {/* Album switcher � only shown when the artist has at
                            least one named album to organize tracks by. */}
                        {albums.length > 0 && (
                          <div
                            className="flex flex-wrap gap-1.5 pb-1"
                            data-testid="album-switcher"
                          >
                            <button
                              type="button"
                              onClick={() => setActiveAlbum('')}
                              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${activeAlbum === '' ? 'text-white' : 'text-white/60 hover:text-white'}`}
                              style={{
                                background: activeAlbum === '' ? `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})` : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${activeAlbum === '' ? 'transparent' : colors.hexBorder}`,
                              }}
                              data-testid="album-tab-all"
                            >
                              All ({ordered.length})
                            </button>
                            {albums.map((alb) => {
                              const count = ordered.filter((s) => ((s as any).album || '').trim() === alb).length;
                              const active = activeAlbum === alb;
                              return (
                                <button
                                  key={alb}
                                  type="button"
                                  onClick={() => setActiveAlbum(alb)}
                                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${active ? 'text-white' : 'text-white/60 hover:text-white'}`}
                                  style={{
                                    background: active ? `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})` : 'rgba(255,255,255,0.04)',
                                    border: `1px solid ${active ? 'transparent' : colors.hexBorder}`,
                                  }}
                                  data-testid={`album-tab-${alb}`}
                                  title={alb}
                                >
                                  <span className="truncate max-w-[140px] inline-block align-bottom">{alb}</span>
                                  <span className="opacity-60 ml-1">({count})</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {/* Hero "audio widget" � featured single (or first track) */}
                        <div
                          className="relative overflow-hidden rounded-3xl border"
                          style={{
                            borderColor: `${colors.hexAccent}40`,
                            background: `linear-gradient(135deg, ${colors.hexPrimary}33 0%, #0a0a0fcc 60%, ${colors.hexAccent}26 100%)`,
                            boxShadow: `0 30px 80px -40px ${colors.hexAccent}80, 0 0 0 1px ${colors.hexAccent}20`,
                          }}
                          data-testid={`card-song-${heroSong.id}`}
                        >
                          {/* Blurred cover backdrop */}
                          {heroSong.coverArt && (
                            <div
                              className="absolute inset-0 opacity-30 pointer-events-none"
                              style={{
                                backgroundImage: `url(${heroSong.coverArt})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                filter: 'blur(40px) saturate(140%)',
                                transform: 'scale(1.2)',
                              }}
                            />
                          )}
                          <div className="relative flex flex-col sm:flex-row gap-4 p-4 sm:p-5">
                            {/* Cover with overlayed play */}
                            <div className="relative flex-shrink-0 mx-auto sm:mx-0">
                              <div
                                className="relative w-40 h-40 sm:w-32 sm:h-32 md:w-36 md:h-36 rounded-2xl overflow-hidden ring-1"
                                style={{
                                  boxShadow: `0 20px 50px -20px ${colors.hexAccent}99`,
                                  // ring color via inline style hack
                                }}
                              >
                                {heroSong.coverArt ? (
                                  <img
                                    src={heroSong.coverArt}
                                    alt={heroSong.title || heroSong.name}
                                    loading="lazy"
                                    decoding="async"
                                    className="w-full h-full object-cover"
                                    data-testid={`img-song-cover-${heroSong.id}`}
                                  />
                                ) : (
                                  <div
                                    className="w-full h-full flex items-center justify-center"
                                    style={{ backgroundColor: `${colors.hexPrimary}33` }}
                                  >
                                    <Music className="h-10 w-10" style={{ color: colors.hexAccent }} />
                                  </div>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handlePlayPause(heroSong)}
                                  className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-all group"
                                  aria-label={isHeroPlaying ? 'Pause' : 'Play'}
                                  data-testid={`button-play-${heroSong.id}`}
                                >
                                  <span
                                    className="inline-flex items-center justify-center w-14 h-14 rounded-full shadow-2xl scale-90 group-hover:scale-100 transition-transform"
                                    style={{
                                      background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
                                    }}
                                  >
                                    {isHeroPlaying ? (
                                      <Pause className="h-6 w-6 text-white" fill="white" />
                                    ) : (
                                      <Play className="h-6 w-6 text-white ml-0.5" fill="white" />
                                    )}
                                  </span>
                                </button>
                              </div>
                            </div>
                            {/* Info column */}
                            <div className="flex-1 min-w-0 text-center sm:text-left">
                              <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                                {heroSong.isSingle && (
                                  <span
                                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em]"
                                    style={{
                                      background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
                                      color: 'white',
                                    }}
                                  >
                                    Single
                                  </span>
                                )}
                                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">
                                  Now featured
                                </span>
                              </div>
                              <h3
                                className="text-2xl sm:text-3xl font-bold text-white mt-2 truncate"
                                data-testid={`text-song-title-${heroSong.id}`}
                              >
                                {heroSong.title || heroSong.name}
                              </h3>
                              <div className="mt-1 text-sm text-white/60 truncate">
                                {(artist as any)?.artistName || artist?.name}
                                {heroSong.duration ? ` · ${heroSong.duration}` : ''}
                              </div>
                              {/* Quick actions row */}
                              <div className="mt-4 flex flex-wrap gap-2 justify-center sm:justify-start">
                                <button
                                  onClick={() => handlePlayPause(heroSong)}
                                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-transform hover:scale-105"
                                  style={{
                                    background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
                                    color: 'white',
                                  }}
                                >
                                  {isHeroPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" fill="white" />}
                                  {isHeroPlaying ? 'Pause' : 'Play'}
                                </button>
                                {isOwnProfile && (
                                  <>
                                    <button
                                      onClick={() => handleToggleSingle(heroSong)}
                                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-transform hover:scale-105"
                                      style={{
                                        backgroundColor: heroSong.isSingle ? `${colors.hexAccent}20` : 'transparent',
                                        border: `1px solid ${colors.hexAccent}66`,
                                        color: colors.hexAccent,
                                      }}
                                      title={heroSong.isSingle ? 'Remove as single' : 'Mark as single'}
                                      data-testid={`button-single-${heroSong.id}`}
                                    >
                                      <Star className="h-3 w-3 mr-1" /> {heroSong.isSingle ? 'Single' : 'Set as single'}
                                    </button>
                                    <button
                                      onClick={() => setCoverDialogSong(heroSong)}
                                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-transform hover:scale-105"
                                      style={{
                                        border: `1px solid ${colors.hexAccent}40`,
                                        color: colors.hexAccent,
                                        background: 'transparent',
                                      }}
                                      title="Generate or upload cover"
                                      data-testid={`button-cover-${heroSong.id}`}
                                    >
                                      <Sparkles className="h-3.5 w-3.5" />
                                      Cover
                                    </button>
                                    <button
                                      onClick={() => setSelectedSongForMetadata(heroSong)}
                                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-transform hover:scale-105"
                                      style={{
                                        border: `1px solid ${colors.hexBorder}`,
                                        color: colors.hexAccent,
                                        background: 'transparent',
                                      }}
                                      title="View metadata"
                                      data-testid={`button-metadata-${heroSong.id}`}
                                    >
                                      <FileText className="h-3.5 w-3.5" />
                                      Metadata
                                    </button>
                                    <button
                                      onClick={() => openMiniStudioForSong(heroSong)}
                                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-transform hover:scale-105"
                                      style={{
                                        border: `1px solid ${colors.hexAccent}66`,
                                        color: colors.hexAccent,
                                        background: `${colors.hexAccent}14`,
                                      }}
                                      title="Open in Mini Studio"
                                      data-testid={`button-mini-studio-${heroSong.id}`}
                                    >
                                      <Headphones className="h-3.5 w-3.5" />
                                      Studio
                                    </button>
                                    <button
                                      onClick={() => openPromoteForSong(heroSong)}
                                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-transform hover:scale-105"
                                      style={{
                                        background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
                                        color: 'white',
                                        border: `1px solid ${colors.hexAccent}`,
                                        opacity: promoteResolving ? 0.6 : 1,
                                        cursor: promoteResolving ? 'wait' : 'pointer',
                                      }}
                                      disabled={promoteResolving}
                                      title="Promote song (generate marketing assets)"
                                      data-testid={`button-promote-${heroSong.id}`}
                                    >
                                      <Megaphone className="h-3.5 w-3.5" />
                                      {promoteResolving && promoteSongTarget?.id === heroSong.id ? 'Preparing...' : 'Promote'}
                                    </button>
                                    <button
                                      onClick={() => {
                                        const url = `/music-video-creator?artist=${encodeURIComponent(artist.name)}&artistId=${artist.pgId || artist.id}&song=${encodeURIComponent(heroSong.name)}&songId=${heroSong.id}${heroSong.audioUrl ? `&audioUrl=${encodeURIComponent(heroSong.audioUrl)}` : ''}${heroSong.coverArt ? `&coverArt=${encodeURIComponent(heroSong.coverArt)}` : ''}${artist.profileImage ? `&images=${encodeURIComponent(artist.profileImage)}` : ''}`;
                                        window.location.href = url;
                                      }}
                                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-transform hover:scale-105"
                                      style={{
                                        background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
                                        color: 'white',
                                      }}
                                      title="Create music video"
                                      data-testid={`button-create-video-${heroSong.id}`}
                                    >
                                      <VideoIcon className="h-3.5 w-3.5" />
                                      Video
                                    </button>
                                    <button
                                      onClick={() => handleDeleteSong(heroSong)}
                                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-transform hover:scale-105"
                                      style={{
                                        border: '1px solid #EF444466',
                                        color: '#EF4444',
                                        background: 'transparent',
                                      }}
                                      title="Delete song"
                                      data-testid={`button-delete-song-${heroSong.id}`}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                )}
                                {/* Karaoke button � always visible */}
                                <button
                                  onClick={() => setKaraokeSong(heroSong)}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold transition-transform hover:scale-105"
                                  style={{
                                    background: 'linear-gradient(135deg, rgba(124,58,237,0.18), rgba(168,85,247,0.14))',
                                    border: '1px solid rgba(168,85,247,0.4)',
                                    color: '#d8b4fe',
                                  }}
                                  title="Open Karaoke"
                                  data-testid={`button-karaoke-hero-${heroSong.id}`}
                                >
                                  <Mic2 className="h-3.5 w-3.5" />
                                  Karaoke
                                </button>
                              </div>
                              {isOwnProfile && (
                                <div className="mt-3">
                                  <HitScoreBar
                                    score={calculateHitScore({
                                      plays: (heroSong as any).plays || Math.floor(Math.random() * 15000),
                                      likes: (heroSong as any).likes || Math.floor(Math.random() * 2000),
                                      shares: (heroSong as any).shares || Math.floor(Math.random() * 500),
                                      mood: (heroSong as any).mood,
                                      genre: heroSong.genre,
                                      createdAt: heroSong.createdAt,
                                    })}
                                    size="sm"
                                    showLabel={true}
                                    animated={true}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Compact widget rows for the rest of the catalog */}
                        {restSongs.length > 0 && (
                        <div
                          className="max-h-[440px] overflow-y-auto pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20"
                          style={{ scrollbarGutter: 'stable' }}
                          data-testid="songs-scroll-list"
                        >
                        {restSongs.map((song) => {
                          const isThisPlaying = playingSongId === song.id;
                          return (
                            <div
                              key={song.id}
                              className="group flex items-center gap-3 p-2 rounded-xl border bg-white/[0.02] hover:bg-white/[0.05] transition-all"
                              style={{
                                borderColor: isThisPlaying ? `${colors.hexAccent}66` : `${colors.hexBorder}`,
                                boxShadow: isThisPlaying ? `0 0 0 1px ${colors.hexAccent}55, 0 8px 22px -14px ${colors.hexAccent}80` : undefined,
                              }}
                              data-testid={`card-song-${song.id}`}
                            >
                              {/* Cover with hover-play */}
                              <div className="relative flex-shrink-0">
                                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-lg overflow-hidden">
                                  {song.coverArt ? (
                                    <img
                                      src={song.coverArt}
                                      alt={song.title || song.name}
                                      className="w-full h-full object-cover"
                                      data-testid={`img-song-cover-${song.id}`}
                                    />
                                  ) : (
                                    <div
                                      className="w-full h-full flex items-center justify-center"
                                      style={{ backgroundColor: `${colors.hexPrimary}33` }}
                                    >
                                      <Music className="h-5 w-5" style={{ color: colors.hexAccent }} />
                                    </div>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handlePlayPause(song)}
                                  className={`absolute inset-0 flex items-center justify-center rounded-lg transition-all ${isThisPlaying ? 'bg-black/40 opacity-100' : 'bg-black/40 opacity-0 group-hover:opacity-100'}`}
                                  aria-label={isThisPlaying ? 'Pause' : 'Play'}
                                  data-testid={`button-play-${song.id}`}
                                >
                                  <span
                                    className="inline-flex items-center justify-center w-7 h-7 rounded-full shadow-xl"
                                    style={{ background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})` }}
                                  >
                                    {isThisPlaying ? (
                                      <Pause className="h-3.5 w-3.5 text-white" fill="white" />
                                    ) : (
                                      <Play className="h-3.5 w-3.5 text-white ml-0.5" fill="white" />
                                    )}
                                  </span>
                                </button>
                              </div>
                              {/* Title + meta */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  {song.isSingle && (
                                    <span
                                      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                                      style={{
                                        background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
                                        color: 'white',
                                      }}
                                    >
                                      ♪
                                    </span>
                                  )}
                                  <h3
                                    className="font-semibold text-white text-sm truncate"
                                    data-testid={`text-song-title-${song.id}`}
                                  >
                                    {song.title || song.name}
                                  </h3>
                                  {isSongLocked(song) && (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setUnlockModalOpen(true); }}
                                      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-white/10 text-white/70 hover:bg-orange-500/30 hover:text-white transition-colors flex-shrink-0"
                                      title="Preview 30s · Unlock the full catalog"
                                      data-testid={`badge-preview-${song.id}`}
                                    >
                                      <Lock className="h-2.5 w-2.5" />
                                      Preview {previewSeconds}s
                                    </button>
                                  )}
                                </div>
                                <div className="text-[11px] text-white/50 truncate mt-0.5">
                                  {(song as any).album ? <span className="text-white/70">{(song as any).album}</span> : ((artist as any)?.artistName || artist?.name)}
                                  {song.duration ? ` · ${song.duration}` : ''}
                                </div>
                              </div>
                              {/* Owner controls (compact) */}
                              {isOwnProfile && (
                                <div className="hidden sm:flex items-center gap-1">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleToggleSingle(song); }}
                                    className="w-7 h-7 inline-flex items-center justify-center rounded-full transition-transform hover:scale-110 text-xs"
                                    style={{
                                      backgroundColor: song.isSingle ? colors.hexAccent : 'transparent',
                                      border: `1px solid ${colors.hexAccent}66`,
                                      color: song.isSingle ? 'white' : colors.hexAccent,
                                    }}
                                    title={song.isSingle ? 'Remove as single' : 'Mark as single'}
                                    data-testid={`button-single-${song.id}`}
                                  >
                                    <Star className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setCoverDialogSong(song); }}
                                    className="w-7 h-7 inline-flex items-center justify-center rounded-full transition-transform hover:scale-110"
                                    style={{
                                      border: `1px solid ${colors.hexBorder}`,
                                      color: colors.hexAccent,
                                      background: 'transparent',
                                    }}
                                    title="Cover image"
                                    data-testid={`button-cover-${song.id}`}
                                  >
                                    <Sparkles className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setSelectedSongForMetadata(song); }}
                                    className="w-7 h-7 inline-flex items-center justify-center rounded-full transition-transform hover:scale-110"
                                    style={{
                                      border: `1px solid ${colors.hexBorder}`,
                                      color: colors.hexAccent,
                                      background: 'transparent',
                                    }}
                                    title="Metadata"
                                    data-testid={`button-metadata-${song.id}`}
                                  >
                                    <FileText className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); openMiniStudioForSong(song); }}
                                    className="w-7 h-7 inline-flex items-center justify-center rounded-full transition-transform hover:scale-110"
                                    style={{
                                      border: `1px solid ${colors.hexAccent}66`,
                                      color: colors.hexAccent,
                                      background: `${colors.hexAccent}14`,
                                    }}
                                    title="Open in Mini Studio"
                                    data-testid={`button-mini-studio-${song.id}`}
                                  >
                                    <Headphones className="h-3 w-3" />
                                  </button>
                                  {typeof song.id === 'number' && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); openPromoteForSong(song); }}
                                      className="w-7 h-7 inline-flex items-center justify-center rounded-full transition-transform hover:scale-110"
                                      style={{
                                        border: `1px solid ${colors.hexAccent}`,
                                        color: 'white',
                                        background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
                                      }}
                                      title="Promote song (generate marketing assets)"
                                      data-testid={`button-promote-${song.id}`}
                                    >
                                      <Megaphone className="h-3 w-3" />
                                    </button>
                                  )}
                                  {typeof song.id !== 'number' && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); openPromoteForSong(song); }}
                                      className="w-7 h-7 inline-flex items-center justify-center rounded-full transition-transform hover:scale-110"
                                      style={{
                                        border: `1px solid ${colors.hexAccent}`,
                                        color: 'white',
                                        background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
                                        opacity: promoteResolving && promoteSongTarget?.id === song.id ? 0.6 : 1,
                                      }}
                                      disabled={promoteResolving && promoteSongTarget?.id === song.id}
                                      title="Promote song (generate marketing assets)"
                                      data-testid={`button-promote-fs-${song.id}`}
                                    >
                                      <Megaphone className="h-3 w-3" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteSong(song)}
                                    className="w-7 h-7 inline-flex items-center justify-center rounded-full transition-transform hover:scale-110"
                                    style={{
                                      border: '1px solid #EF444466',
                                      color: '#EF4444',
                                      background: 'transparent',
                                    }}
                                    title="Delete"
                                    data-testid={`button-delete-song-${song.id}`}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                              {/* Share button � visible to everyone, links to /song/:id when PG id available */}
                              {(() => {
                                const pgId = !isNaN(Number(song.id)) ? Number(song.id) : null;
                                const shareUrl = pgId
                                  ? `${window.location.origin}/song/${pgId}`
                                  : window.location.href.split('#')[0];
                                const songTitle = song.title || song.name;
                                const artistNameStr = (artist as any)?.artistName || artist?.name || '';
                                return (
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      const text = `?? "${songTitle}" - ${artistNameStr} on Boostify Music`;
                                      if (navigator.share) {
                                        try {
                                          await navigator.share({ title: `${songTitle} | Boostify Music`, text, url: shareUrl });
                                        } catch {}
                                      } else {
                                        await navigator.clipboard.writeText(shareUrl);
                                        toast({ title: 'Link copied!', description: 'Share it on any platform.' });
                                      }
                                    }}
                                    className="w-7 h-7 inline-flex items-center justify-center rounded-full transition-transform hover:scale-110 ml-1"
                                    style={{
                                      border: `1px solid ${colors.hexAccent}66`,
                                      color: colors.hexAccent,
                                      background: 'transparent',
                                    }}
                                    title="Share this song"
                                    data-testid={`button-share-song-${song.id}`}
                                  >
                                    <Share2 className="h-3 w-3" />
                                  </button>
                                );
                              })()}
                              {/* Karaoke button � visible to everyone */}
                              <button
                                onClick={(e) => { e.stopPropagation(); setKaraokeSong(song); }}
                                className="w-7 h-7 inline-flex items-center justify-center rounded-full transition-transform hover:scale-110 ml-1"
                                style={{
                                  background: 'linear-gradient(135deg, rgba(124,58,237,0.18), rgba(168,85,247,0.14))',
                                  border: '1px solid rgba(168,85,247,0.4)',
                                  color: '#d8b4fe',
                                }}
                                title="Karaoke"
                                data-testid={`button-karaoke-public-${song.id}`}
                              >
                                <Mic2 className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}
                        </div>
                        )}
                      </>
                    );
                  })()}
                </div>
                )}
              </div>
                        );
                      } else if (sectionId === 'videos' && (videos.length > 0 || isOwnProfile)) {
                        sectionElement = (
            <div className={cardStyles} style={cardStyleInline}>
                {renderSectionHeader(sectionId, VideoIcon, t('profile.sections.videos'), videos.length,
                  isOwnProfile ? (
                    <>
                    <UploadLimitBanner current={videos.length} max={tierLimits.limits.videos} type="videos" accentColor={colors.hexAccent} />
                    <Dialog open={showUploadVideoDialog} onOpenChange={setShowUploadVideoDialog}>
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          className="rounded-full"
                          style={{ backgroundColor: tierLimits.canUploadVideo(videos.length) ? colors.hexPrimary : '#555', color: 'white' }}
                          data-testid="button-upload-video"
                          disabled={!tierLimits.canUploadVideo(videos.length)}
                          title={!tierLimits.canUploadVideo(videos.length) ? `Video limit reached (${tierLimits.limits.videos})` : undefined}
                        >
                          {!tierLimits.canUploadVideo(videos.length) ? <Lock className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                          Agregar Video
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Agregar Nuevo Video</DialogTitle>
                          <DialogDescription>
                            Agrega un video de YouTube o sube un archivo local
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-3">
                            <Label>Tipo de Video</Label>
                            <RadioGroup 
                              value={videoUploadType} 
                              onValueChange={(value) => setVideoUploadType(value as 'youtube' | 'file')}
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="youtube" id="youtube" />
                                <Label htmlFor="youtube" className="cursor-pointer">URL de YouTube</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="file" id="file" />
                                <Label htmlFor="file" className="cursor-pointer">Subir Archivo (MP4, MPG, MOV, AVI)</Label>
                              </div>
                            </RadioGroup>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="video-title">Título del Video</Label>
                            <Input
                              id="video-title"
                              value={newVideoTitle}
                              onChange={(e) => setNewVideoTitle(e.target.value)}
                              placeholder="Mi Video Musical"
                            />
                          </div>

                          {videoUploadType === 'youtube' ? (
                            <div className="space-y-2">
                              <Label htmlFor="video-url">URL del Video de YouTube</Label>
                              <Input
                                id="video-url"
                                value={newVideoUrl}
                                onChange={(e) => setNewVideoUrl(e.target.value)}
                                placeholder="https://youtube.com/watch?v=..."
                              />
                            </div>
                          ) : (
                            <>
                              <div className="space-y-2">
                                <Label htmlFor="video-file">Archivo de Video</Label>
                                <Input
                                  id="video-file"
                                  type="file"
                                  accept="video/mp4,video/mpeg,video/webm,.mp4,.mpg,.webm"
                                  ref={videoFileInputRef}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const ext = file.name.split('.').pop()?.toLowerCase();
                                      if (ext === 'mov' || ext === 'avi') {
                                        toast({
                                          title: "⚠️ Formato no recomendado",
                                          description: `Los archivos .${ext} no son compatibles con todos los navegadores. Para mejor compatibilidad, usa .MP4 o .WEBM`,
                                          variant: "destructive",
                                        });
                                      }
                                    }
                                    setVideoFile(file || null);
                                  }}
                                />
                                {videoFile && (
                                  <div className="space-y-1">
                                    <p className="text-sm text-gray-400">
                                      Archivo seleccionado: {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(2)} MB)
                                    </p>
                                    {videoFile.name.toLowerCase().endsWith('.mov') && (
                                      <p className="text-xs text-orange-400 flex items-center gap-1">
                                        <AlertCircle className="h-3 w-3" />
                                        ⚠️ Formato .MOV no funciona en Chrome/Firefox. Usa .MP4 para mejor compatibilidad.
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="video-password">Password de Descarga</Label>
                                <Input
                                  id="video-password"
                                  type="password"
                                  value={videoPassword}
                                  onChange={(e) => setVideoPassword(e.target.value)}
                                  placeholder="Ingresa un password para proteger la descarga"
                                />
                                <p className="text-xs text-gray-500">
                                  Este password será requerido para descargar el video
                                </p>
                              </div>
                            </>
                          )}
                          
                          {/* Video Script PDF (opcional) */}
                          <div className="space-y-2 border-t border-gray-700 pt-4">
                            <Label htmlFor="video-pdf" className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-orange-400" />
                              Video Script (PDF) — Opcional
                            </Label>
                            <Input
                              id="video-pdf"
                              type="file"
                              accept="application/pdf,.pdf"
                              ref={pdfFileInputRef}
                              onChange={(e) => setVideoPdfFile(e.target.files?.[0] || null)}
                            />
                            {videoPdfFile && (
                              <p className="text-sm text-gray-400">
                                PDF seleccionado: {videoPdfFile.name} ({(videoPdfFile.size / 1024 / 1024).toFixed(2)} MB)
                              </p>
                            )}
                            <p className="text-xs text-gray-500">
                              Sube el guión del video en formato PDF para que se pueda consultar junto al video
                            </p>
                          </div>

                          {/* Barra de progreso */}
                          {isUploadingVideo && videoUploadProgress > 0 && (
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Subiendo video...</span>
                                <span className="font-medium" style={{ color: colors.hexAccent }}>{videoUploadProgress}%</span>
                              </div>
                              <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                                <div 
                                  className="h-2.5 rounded-full transition-all duration-300"
                                  style={{ 
                                    width: `${videoUploadProgress}%`,
                                    background: `linear-gradient(90deg, ${colors.hexPrimary}, ${colors.hexAccent})`
                                  }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setShowUploadVideoDialog(false);
                              setNewVideoTitle('');
                              setNewVideoUrl('');
                              setVideoFile(null);
                              setVideoPassword('');
                              setVideoPdfFile(null);
                              setVideoUploadType('youtube');
                              setVideoUploadProgress(0);
                            }}
                            disabled={isUploadingVideo}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleUploadVideo}
                            disabled={isUploadingVideo}
                            style={{ backgroundColor: colors.hexPrimary, color: 'white' }}
                          >
                            {isUploadingVideo ? `Subiendo... ${videoUploadProgress}%` : 'Agregar Video'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    </>
                  ) : undefined
                )}
                {sectionExpanded[sectionId] && (<>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {videos.map((video, index) => {
                    logger.info('?? Rendering video card:', { 
                      title: video.title, 
                      url: video.url, 
                      thumbnailUrl: video.thumbnailUrl,
                      hasUrl: !!video.url,
                      isYouTube: video.url?.includes('youtube')
                    });
                    
                    return (
                    <div
                      key={video.id}
                      className="rounded-lg sm:rounded-xl overflow-hidden bg-black/50 hover:bg-gray-900/50 transition-all duration-200 border"
                      style={{ borderColor: colors.hexBorder }}
                      data-testid={`card-video-${index}`}
                    >
                      <div
                        onClick={() => setPlayingVideo(video)}
                        className="block cursor-pointer relative group"
                      >
                        {/* Prefer a live video preview (muted/looped) over a static thumbnail
                            because a still frame at t=0 is often black. Fallback to the
                            thumbnail image, then to an icon. YouTube URLs can't be previewed
                            inline so we keep the static thumbnail for those. */}
                        {video.url && !video.url.includes('youtube') && !video.url.includes('youtu.be') ? (
                          <video
                            src={video.url}
                            poster={video.thumbnailUrl || undefined}
                            className="w-full h-36 sm:h-40 md:h-44 object-cover bg-black"
                            muted
                            loop
                            playsInline
                            preload="none"
                            onMouseEnter={(e) => {
                              // Lazy preview: only start downloading + playing on hover,
                              // so the first paint never loads every gallery video at once.
                              const el = e.currentTarget;
                              el.play().catch(() => {});
                            }}
                            onMouseLeave={(e) => {
                              const el = e.currentTarget;
                              el.pause();
                              try { el.currentTime = 0; } catch {}
                            }}
                          />
                        ) : video.thumbnailUrl ? (
                          <img
                            src={video.thumbnailUrl}
                            alt={video.title}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-36 sm:h-40 md:h-44 object-cover"
                          />
                        ) : (
                          <div 
                            className="w-full h-36 sm:h-40 md:h-44 flex items-center justify-center"
                            style={{ backgroundColor: `${colors.hexPrimary}33` }}
                          >
                            <VideoIcon className="h-10 sm:h-12 w-10 sm:w-12" style={{ color: colors.hexAccent }} />
                          </div>
                        )}
                        {/* Play overlay � always visible (subtle), stronger on hover */}
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center pointer-events-none">
                          <div 
                            className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shadow-lg opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all"
                            style={{ backgroundColor: colors.hexPrimary }}
                          >
                            <Play className="h-7 w-7 sm:h-8 sm:w-8 text-white ml-1" fill="white" />
                          </div>
                        </div>
                      </div>
                      <div className="p-3">
                        <h3 className="font-medium text-white text-sm">{video.title || 'Music Video'}</h3>
                        <p className="text-xs text-gray-400 mt-1">
                          {video.type === 'uploaded' ? 'Video Local' : 'Powered by Boostify'}
                        </p>
                        
                        <div className="space-y-2 mt-2">
                          {/* Bot�n de descarga - visible para todos si es video subido */}
                          {video.type === 'uploaded' && video.downloadPassword && (
                            <button
                              className="w-full py-2.5 sm:py-2 px-4 rounded-full text-xs sm:text-sm font-bold transition-all duration-300 transform hover:scale-105 shadow-lg active:scale-95"
                              style={{ 
                                background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
                                color: 'white'
                              }}
                              onClick={() => handleDownloadVideo(video)}
                              data-testid={`button-download-video-${video.id}`}
                            >
                              <Download className="h-3.5 w-3.5 sm:h-3 sm:w-3 inline mr-1.5 sm:mr-1" />
                              Descargar Video
                            </button>
                          )}

                          {/* Bot�n Ver Gui�n PDF - visible para todos si tiene script */}
                          {video.scriptPdfUrl && (
                            <button
                              className="w-full py-2.5 sm:py-2 px-4 rounded-full text-xs sm:text-sm font-bold transition-all duration-300 transform hover:scale-105 shadow-lg active:scale-95"
                              style={{ 
                                background: 'linear-gradient(135deg, #f97316, #ea580c)',
                                color: 'white'
                              }}
                              onClick={() => setViewingPdf(video)}
                              data-testid={`button-view-script-${video.id}`}
                            >
                              <FileText className="h-3.5 w-3.5 sm:h-3 sm:w-3 inline mr-1.5 sm:mr-1" />
                              Ver Video Script
                            </button>
                          )}

                          {isOwnProfile && (
                            <>
                              {/* Subir Script PDF independiente */}
                              {!video.scriptPdfUrl && (
                                <label className="block">
                                  <input
                                    type="file"
                                    accept="application/pdf,.pdf"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleUploadPdfToVideo(video.id, file);
                                      e.target.value = '';
                                    }}
                                  />
                                  <span
                                    className="w-full py-2 px-4 rounded-full text-xs font-bold transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
                                    style={{ 
                                      background: uploadingPdfForVideoId === video.id ? '#666' : 'linear-gradient(135deg, #f97316, #ea580c)',
                                      color: 'white',
                                      pointerEvents: uploadingPdfForVideoId === video.id ? 'none' : 'auto'
                                    }}
                                  >
                                    <FileText className="h-3 w-3" />
                                    {uploadingPdfForVideoId === video.id ? 'Subiendo PDF...' : 'Subir Video Script (PDF)'}
                                  </span>
                                </label>
                              )}

                              {/* Bot�n promocional para YouTube Views */}
                              <Link href="/youtube-views">
                                <button
                                  className="w-full py-2 px-4 rounded-full text-xs font-bold transition-all duration-300 transform hover:scale-105 shadow-lg"
                                  style={{ 
                                    background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
                                    color: 'white'
                                  }}
                                  data-testid={`button-promote-video-${video.id}`}
                                >
                                  <Sparkles className="h-3 w-3 inline mr-1" />
                                  Promocionar Video
                                </button>
                              </Link>
                              
                              {/* Bot�n de borrar */}
                              <button
                                className="w-full py-2 px-4 rounded-full text-xs font-medium transition duration-300 hover:bg-red-600"
                                style={{ 
                                  backgroundColor: 'transparent',
                                  borderColor: '#EF4444',
                                  borderWidth: '1px',
                                  color: '#EF4444'
                                }}
                                onClick={() => handleDeleteVideo(video)}
                                data-testid={`button-delete-video-${video.id}`}
                              >
                                <Trash2 className="h-3 w-3 inline mr-1" />
                                Borrar Video
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                  })}
                </div>

                {/* AI Generated Music Videos Section */}
                {musicVideoProjects.length > 0 && (
                  <div className="mt-6 pt-4 border-t" style={{ borderColor: colors.hexBorder }}>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${colors.hexPrimary}20` }}>
                        <Sparkles className="h-4 w-4" style={{ color: colors.hexAccent }} />
                      </div>
                      <h3 className="font-semibold text-sm" style={{ color: colors.hexAccent }}>
                        AI Music Videos ({musicVideoProjects.length})
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      {musicVideoProjects.map((project, index) => (
                        <div
                          key={project.id}
                          className="rounded-lg sm:rounded-xl overflow-hidden bg-gradient-to-br from-purple-900/30 to-orange-900/30 hover:from-purple-900/50 hover:to-orange-900/50 transition-all duration-200 border"
                          style={{ borderColor: colors.hexBorder }}
                          data-testid={`card-ai-video-${index}`}
                        >
                          <div className="relative group">
                            {/* Prefer live muted/looped preview so we never show a black frame. */}
                            {project.finalVideoUrl ? (
                              <video
                                src={project.finalVideoUrl}
                                poster={project.thumbnail || undefined}
                                className="w-full h-36 sm:h-40 md:h-44 object-cover bg-black"
                                muted
                                loop
                                playsInline
                                preload="none"
                                onMouseEnter={(e) => { e.currentTarget.play().catch(() => {}); }}
                                onMouseLeave={(e) => {
                                  const el = e.currentTarget;
                                  el.pause();
                                  try { el.currentTime = 0; } catch {}
                                }}
                              />
                            ) : project.thumbnail ? (
                              <img
                                src={project.thumbnail}
                                alt={project.songName}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-36 sm:h-40 md:h-44 object-cover"
                              />
                            ) : (
                              <div 
                                className="w-full h-36 sm:h-40 md:h-44 flex items-center justify-center"
                                style={{ backgroundColor: `${colors.hexPrimary}33` }}
                              >
                                <Film className="h-10 sm:h-12 w-10 sm:w-12" style={{ color: colors.hexAccent }} />
                              </div>
                            )}
                            {/* AI Badge */}
                            <div className="absolute top-2 left-2">
                              <span 
                                className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white flex items-center gap-1"
                                style={{ background: `linear-gradient(135deg, ${colors.hexPrimary}, #8B5CF6)` }}
                              >
                                <Bot className="h-3 w-3" />
                                AI Generated
                              </span>
                            </div>
                            {/* Play overlay */}
                            {project.finalVideoUrl && (
                              <a
                                href={project.finalVideoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                              >
                                <div 
                                  className="w-16 h-16 rounded-full flex items-center justify-center"
                                  style={{ backgroundColor: colors.hexPrimary }}
                                >
                                  <Play className="h-8 w-8 text-white ml-1" fill="white" />
                                </div>
                              </a>
                            )}
                          </div>
                          <div className="p-3">
                            <h3 className="font-medium text-white text-sm">{project.songName || 'Music Video'}</h3>
                            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                              <Sparkles className="h-3 w-3" />
                              Created with Boostify AI
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                </>)}
              </div>
                        );
                      } else if (sectionId === 'news' && (newsArticles.length > 0 || isOwnProfile)) {
                        sectionElement = (
            <div className={cardStyles} style={cardStyleInline}>
                {renderSectionHeader(sectionId, Newspaper, 'News', newsArticles.length)}

                {sectionExpanded[sectionId] && (
                  <>
                    {/* AI News Generator � visible only to owner */}
                    {isOwnProfile && userProfile?.pgId && (
                      <div className="mb-5">
                        <ArtistNewsGenerator
                          userId={Number(userProfile.pgId)}
                          artistName={userProfile?.artistName || userProfile?.username || 'Artist'}
                          isOwner={isOwnProfile}
                          colors={colors}
                        />
                      </div>
                    )}

                    {newsArticles.length === 0 ? (
                      <div className="text-center py-12 text-gray-400">
                        <Newspaper className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>No news available yet</p>
                        {isOwnProfile && (
                          <p className="text-sm mt-2">
                            Use the "Generate News with AI" button in edit profile
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="overflow-x-auto pb-4 -mx-4 px-4">
                        <div className="flex gap-4 min-w-max">
                          {newsArticles.map((article) => {
                            const categoryColors = {
                              release: { bg: '#10B981', text: 'Release' },
                              performance: { bg: '#8B5CF6', text: 'Performance' },
                              collaboration: { bg: '#F59E0B', text: 'Collaboration' },
                              achievement: { bg: '#EF4444', text: 'Achievement' },
                              lifestyle: { bg: '#3B82F6', text: 'Lifestyle' }
                            };
                            
                            const categoryInfo = categoryColors[article.category] || { bg: colors.hexPrimary, text: article.category };
                            
                            return (
                              <div
                                key={article.id}
                                className="w-80 flex-shrink-0 bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-all duration-300"
                              >
                                <div className="relative h-48 overflow-hidden">
                                  <img
                                    src={article.imageUrl}
                                    alt={article.title}
                                    className="w-full h-full object-cover"
                                  />
                                  <div 
                                    className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-semibold text-white"
                                    style={{ backgroundColor: categoryInfo.bg }}
                                  >
                                    {categoryInfo.text}
                                  </div>
                                </div>
                                
                                <div className="p-4 space-y-3">
                                  <h3 className="font-semibold text-white line-clamp-2 leading-tight">
                                    {article.title}
                                  </h3>
                                  
                                  <p className="text-sm text-gray-400 line-clamp-3 leading-relaxed">
                                    {article.summary || article.content}
                                  </p>
                                  
                                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                      <Eye className="h-3 w-3" />
                                      {article.views || 0} views
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-xs h-7"
                                      style={{ color: colors.hexAccent }}
                                      onClick={() => {
                                        setSelectedArticle(article);
                                        setIsNewsModalOpen(true);
                                      }}
                                      data-testid={`button-read-more-${article.id}`}
                                    >
                                      Read more ?
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
                        );
                      } else if (sectionId === 'social-hub') {
                        // Command Center � Responsive icon grid
                        const leftEntries = Object.entries(allSections)
                          .filter(([id, sec]) => id !== 'social-hub' && (!sec.isOwnerOnly || isOwnProfile))
                          .map(([id, sec]) => ({ id, name: sec.name, icon: sec.icon, side: 'left' as const }));
                        const rightEntries = Object.entries(rightWidgets)
                          .map(([id, w]) => ({ id, name: w.name, icon: w.icon, side: 'right' as const }));


                        sectionElement = (
                          <div className={cardStyles} style={cardStyleInline}>
                            {renderSectionHeader(sectionId, Antenna, 'Broadcast Studio')}
                            {sectionExpanded[sectionId] && (
                              <div className="rounded-2xl overflow-hidden mx-auto w-[72%] sm:w-full" style={{ background: 'linear-gradient(180deg, #050505 0%, #000 100%)' }}>
                                {/* Ambient glow bg */}
                                <div className="pointer-events-none" style={{
                                  position: 'absolute', inset: 0, borderRadius: 16, zIndex: 0,
                                  background: `radial-gradient(ellipse 70% 40% at 50% 0%, ${colors.hexPrimary}12, transparent 70%)`,
                                }} />

                                {/* Artist hero */}
                                <div className="relative z-10 flex flex-col items-center pt-3 sm:pt-5 pb-2 sm:pb-3">
                                  <div className="relative">
                                    {artist.profileImage ? (
                                      <img
                                        src={artist.profileImage}
                                        alt={artist.name}
                                        className="w-10 h-10 sm:w-16 sm:h-16 rounded-full object-cover"
                                        style={{
                                          border: `2px solid ${colors.hexAccent}`,
                                          boxShadow: `0 0 20px ${colors.hexAccent}30`,
                                        }}
                                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                      />
                                    ) : (
                                      <div
                                        className="w-10 h-10 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-white font-bold text-lg"
                                        style={{ background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`, border: `2px solid ${colors.hexAccent}` }}
                                      >
                                        {(artist.name || 'A').charAt(0).toUpperCase()}
                                      </div>
                                    )}
                                    <div
                                      className="absolute -bottom-1 -right-1 w-3.5 h-3.5 sm:w-5 sm:h-5 rounded-full border-2 border-black flex items-center justify-center"
                                      style={{ background: colors.hexAccent, boxShadow: `0 0 8px ${colors.hexAccent}60` }}
                                    >
                                      <Zap className="w-2 h-2 sm:w-2.5 sm:h-2.5 text-black" />
                                    </div>
                                  </div>
                                  <p className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs font-bold text-center" style={{ color: colors.hexAccent }}>{artist.name}</p>
                                  <p className="text-[8px] sm:text-[10px] text-gray-600 mt-0.5 text-center px-1">
                                    {isOwnProfile ? 'Tap to toggle — drag to reorder' : 'Profile modules'}
                                  </p>
                                  {isOwnProfile && (
                                    <div className="flex items-center justify-center gap-3 mt-1.5">
                                      <span className="flex items-center gap-1 text-[7px] sm:text-[9px] font-semibold" style={{ color: '#22e06b' }}>
                                        <span className="w-2 h-2 rounded-full" style={{ background: '#22e06b', boxShadow: '0 0 6px #22e06baa' }} />
                                        Active
                                      </span>
                                      <span className="flex items-center gap-1 text-[7px] sm:text-[9px] font-semibold" style={{ color: '#f87171' }}>
                                        <span className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }} />
                                        Off · tap to activate
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Divider */}
                                <div className="mx-2 sm:mx-4 mb-2.5 sm:mb-3" style={{ height: '1px', background: `linear-gradient(to right, transparent, ${colors.hexAccent}25, transparent)` }} />

                                {/* Presets strip � owner only */}
                                {isOwnProfile && (
                                  <div className="relative z-10 px-2 sm:px-3 pb-2">
                                    <p className="text-[7px] sm:text-[8px] uppercase tracking-[0.16em] font-bold mb-1 px-0.5" style={{ color: `${colors.hexAccent}55` }}>
                                      Presets
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {STUDIO_PRESETS.map(preset => (
                                        <button
                                          key={preset.id}
                                          onClick={() => {
                                            setSectionVisibility(prev => ({ ...prev, ...preset.vis }));
                                            autoSaveLayout();
                                            toast({ title: `${preset.label} applied`, description: 'Layout updated' });
                                          }}
                                          className="text-[7px] sm:text-[8px] px-2 py-0.5 rounded-full border transition-all duration-200 hover:scale-105 active:scale-95"
                                          style={{
                                            background: 'rgba(255,255,255,0.04)',
                                            borderColor: `${colors.hexAccent}30`,
                                            color: 'rgba(255,255,255,0.55)',
                                          }}
                                        >
                                          {preset.label}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Sections grid */}
                                <div className="relative z-10 px-2 sm:px-3 pb-2.5 sm:pb-3">
                                  <p className="text-[8px] sm:text-[9px] uppercase tracking-[0.16em] sm:tracking-[0.2em] font-bold mb-1.5 sm:mb-2 px-0.5" style={{ color: `${colors.hexAccent}55` }}>
                                    Sections
                                  </p>
                                  <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                                    {renderModuleGrid(leftEntries)}
                                  </div>
                                </div>

                                {/* Widgets grid */}
                                <div className="relative z-10 px-2 sm:px-3 pb-3 sm:pb-4">
                                  <div className="mb-2" style={{ height: '1px', background: `linear-gradient(to right, transparent, ${colors.hexAccent}15, transparent)` }} />
                                  <p className="text-[8px] sm:text-[9px] uppercase tracking-[0.16em] sm:tracking-[0.2em] font-bold mb-1.5 sm:mb-2 px-0.5" style={{ color: `${colors.hexAccent}55` }}>
                                    Widgets
                                  </p>
                                  <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
                                    {renderModuleGrid(rightEntries)}
                                  </div>
                                </div>

                                {/* Social links */}
                                {[artist.youtube, artist.instagram, artist.spotify, artist.twitter].some(Boolean) && (
                                  <div className="relative z-10 pb-3 sm:pb-4 px-2 sm:px-3">
                                    <div className="mb-2" style={{ height: '1px', background: `linear-gradient(to right, transparent, ${colors.hexAccent}15, transparent)` }} />
                                    <div className="flex justify-center gap-1.5 sm:gap-2">
                                      {[
                                        { url: artist.youtube, Icon: Youtube, name: 'YouTube', color: '#FF0000' },
                                        { url: artist.instagram, Icon: Instagram, name: 'Instagram', color: '#E4405F' },
                                        { url: artist.spotify, Icon: Music2, name: 'Spotify', color: '#1DB954' },
                                        { url: artist.twitter, Icon: Twitter, name: 'X', color: '#FFFFFF' },
                                      ].filter(s => s.url).map((social, i) => {
                                        const SocialIcon = social.Icon;
                                        return (
                                          <a
                                            key={i}
                                            href={social.url!}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title={social.name}
                                            aria-label={social.name}
                                            className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl border flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
                                            style={{
                                              background: 'rgba(255,255,255,0.04)',
                                              borderColor: 'rgba(255,255,255,0.08)',
                                            }}
                                          >
                                            <SocialIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: social.color }} />
                                          </a>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Active counter */}
                                {isOwnProfile && (
                                  <div className="relative z-10 text-center pb-2.5 sm:pb-3">
                                    <span className="text-[8px] sm:text-[9px] font-medium text-gray-600">
                                      {Object.values(sectionVisibility).filter(v => v !== false).length + Object.values(rightVisibility).filter(v => v !== false).length} modules active
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      } else if (sectionId === 'social-posts') {
                        sectionElement = (
                          <div className={cardStyles} style={cardStyleInline}>
                            {renderSectionHeader(sectionId, Share2, 'Posts Social Media')}
                            {sectionExpanded[sectionId] && (
                              <SocialPostsDisplay userId={artist.pgId} isOwner={isOwnProfile} colors={colors} />
                            )}
                          </div>
                        );
                      } else if (sectionId === 'tokenization' && isOwnProfile) {
                        sectionElement = (
                          <div className={cardStyles} style={cardStyleInline}>
                            {renderSectionHeader(sectionId, Coins, 'Song Tokenization')}
                            {sectionExpanded[sectionId] && (
                              <TokenizationPanel 
                                artistId={artist.pgId}
                                artistName={artist.name}
                                artistImage={artist.profileImage}
                                availableSongs={songs}
                              />
                            )}
                          </div>
                        );
                      } else if (sectionId === 'merchandise' && (products.length > 0 || isOwnProfile)) {
                        const realCount = products.length;
                        const countLabel = realCount >= 100
                          ? `${Math.floor(realCount / 10) * 10}+ Products`
                          : realCount > 0 ? `${realCount} Products` : '0';
                        sectionElement = (
            <div className={cardStyles} style={cardStyleInline}>
                {renderSectionHeader(sectionId, ShoppingBag, 'Official Store', countLabel)}

                {/* Contract check for own profile - artist must sign before selling */}
                {sectionExpanded[sectionId] && isOwnProfile && !merchContractData?.hasContract && (
                  <MerchCollaborationContract
                    artistId={artist.pgId}
                    artistName={artist.name}
                    colors={colors}
                    onContractSigned={() => refetchMerchContract()}
                  />
                )}

                {/* Revenue info badge (visible to everyone when contract is active) */}
                {sectionExpanded[sectionId] && merchContractData?.hasContract && (
                  <div 
                    className="mb-4 p-3 rounded-lg border flex items-center gap-3"
                    style={{ 
                      borderColor: colors.hexBorder,
                      background: `linear-gradient(135deg, ${colors.hexPrimary}10, ${colors.hexAccent}08)`
                    }}
                  >
                    <div 
                      className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ 
                        background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`
                      }}
                    >
                      <Handshake className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">
                          Boostify · {artist.name}
                        </span>
                        <span 
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                          style={{ 
                            background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
                            color: 'white'
                          }}
                        >
                          {merchContractData.contract?.artistRevenueShare || '70'}% Artist
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        Official collaboration · Produced by Boostify · Zero inventory risk
                      </p>
                    </div>
                  </div>
                )}

                {/* Enhanced Store section (visible when contract signed OR for visitors) */}
                {sectionExpanded[sectionId] && (merchContractData?.hasContract || !isOwnProfile) && (
                  <OfficialStoreSection
                    products={products as any}
                    artist={{
                      pgId: artist.pgId,
                      name: artist.name,
                      slug: ((artist as any) || {})['slug'] as string | undefined,
                      profileImage: artist.profileImage,
                    }}
                    colors={colors}
                    isOwnProfile={!!isOwnProfile}
                    hasContract={!!merchContractData?.hasContract}
                    artistRevenueShare={merchContractData?.contract?.artistRevenueShare || '70'}
                    masterJson={(userProfile as any)?.masterJson || (artist as any)?.masterJson}
                    onBuyClick={(product) => {
                      // Express server endpoint (works on Render)
                      const checkoutUrl = '/api/artist-profile/create-checkout-session';
                      // sizes[0] = selected size (QuickViewModal puts chosen size first)
                      const size = product.sizes && product.sizes.length > 0 ? product.sizes[0] : '';
                      // Extract type from stored field or product name for Printful variant lookup
                      const productType = (product as any).type ||
                        ['T-Shirt', 'Hoodie', 'Cap', 'Poster', 'Sticker Pack', 'Mug']
                          .find(t => product.name?.includes(t)) || '';
                      fetch(checkoutUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          productName: product.name,
                          productPrice: product.price,
                          productImage: product.imageUrl,
                          artistName: artist.name,
                          productId: product.id,
                          productType,
                          size,
                        }),
                      })
                        .then(r => r.json())
                        .then((result: any) => {
                          if (result.success && result.url) {
                            window.location.href = result.url;
                          } else {
                            throw new Error(result.error || 'Checkout failed');
                          }
                        })
                        .catch((err: any) => {
                          console.error('Checkout error:', err);
                        });
                    }}
                  />
                )}
              </div>
                        );
                      } else if (sectionId === 'galleries') {
                        sectionElement = (
                          <div className={cardStyles} style={cardStyleInline}>
                            {renderSectionHeader(sectionId, Image, 'Image Galleries')}
                            {sectionExpanded[sectionId] && (
                              <ImageGalleryDisplay 
                                artistId={artistId}
                                pgId={artist.pgId}
                                isOwner={!!isOwnProfile}
                                refreshKey={galleriesRefreshKey}
                              />
                            )}
                          </div>
                        );
                      } else if (sectionId === 'downloads') {
                        sectionElement = (
                          <div className={cardStyles} style={cardStyleInline}>
                            {renderSectionHeader(sectionId, Download, 'Downloads')}
                            {sectionExpanded[sectionId] && (
                              <ArtistDownloads
                                artistId={artistId}
                                pgId={artist.pgId}
                                isOwner={!!isOwnProfile}
                                colors={{ ...colors, hexBg: '#111111' }}
                              />
                            )}
                          </div>
                        );
                      } else if (sectionId === 'monetize-cta') {
                        sectionElement = (
                          <div className={cardStyles} style={{ ...cardStyleInline, position: 'relative', overflow: 'hidden' }}>
                            {renderSectionHeader(sectionId, Sparkles, 'Launch Your Career')}
                            {sectionExpanded[sectionId] && (
                              <>
                            {/* Animated background */}
                            <div className="absolute inset-0 pointer-events-none" style={{ overflow: 'hidden' }}>
                              <div style={{
                                position: 'absolute', inset: 0,
                                background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${colors.hexPrimary}18, transparent 70%)`,
                                animation: 'pulseGlow 3s ease-in-out infinite alternate',
                              }} />
                              {[...Array(5)].map((_, i) => (
                                <div key={i} style={{
                                  position: 'absolute',
                                  width: 3, height: 3,
                                  borderRadius: '50%',
                                  background: colors.hexAccent,
                                  opacity: 0.4,
                                  left: `${15 + i * 18}%`,
                                  top: `${20 + (i % 3) * 20}%`,
                                  animation: `float ${2 + i * 0.4}s ease-in-out infinite alternate`,
                                  animationDelay: `${i * 0.3}s`,
                                }} />
                              ))}
                            </div>

                            <div className="relative z-10">
                              {/* Animated icon badge */}
                              <div className="flex justify-center mb-4">
                                <motion.div
                                  animate={{ scale: [1, 1.08, 1], rotate: [0, 3, -3, 0] }}
                                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                                  style={{
                                    background: `linear-gradient(135deg, ${colors.hexPrimary}30, ${colors.hexAccent}25)`,
                                    boxShadow: `0 0 24px ${colors.hexAccent}40`,
                                    border: `1px solid ${colors.hexAccent}30`,
                                  }}
                                >
                                  <Sparkles className="h-7 w-7" style={{ color: colors.hexAccent }} />
                                </motion.div>
                              </div>

                              {/* Headline */}
                              <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5 }}
                                className="text-center mb-2"
                              >
                                <h3 className="text-base font-bold tracking-tight" style={{ color: colors.hexAccent }}>
                                  Turn Your Music Into a Business
                                </h3>
                                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed px-1">
                                  Release tracks, grow your fanbase, and earn — all from one platform built for independent artists.
                                </p>
                              </motion.div>

                              {/* Feature pills */}
                              <div className="flex flex-wrap justify-center gap-1.5 my-3">
                                {['Distribute Music', 'Sell Beats', 'Fan Merch', 'Live Shows'].map((feat, i) => (
                                  <motion.span
                                    key={feat}
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.1 + i * 0.08 }}
                                    className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full"
                                    style={{ background: `${colors.hexAccent}18`, color: colors.hexAccent, border: `1px solid ${colors.hexAccent}25` }}
                                  >
                                    {feat}
                                  </motion.span>
                                ))}
                              </div>

                              {/* CTA Button */}
                              <Link href="/producer-tools">
                                <motion.button
                                  whileHover={{ scale: 1.03 }}
                                  whileTap={{ scale: 0.97 }}
                                  className="w-full py-3 px-4 rounded-xl text-sm font-bold shadow-lg flex items-center justify-center gap-2 mt-1"
                                  style={{ 
                                    background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
                                    color: 'white',
                                    boxShadow: `0 4px 20px ${colors.hexAccent}30`,
                                  }}
                                  data-testid="button-producer-tools"
                                >
                                  <Sparkles className="h-4 w-4" />
                                  <span>Start Your Journey</span>
                                  <ArrowRight className="h-4 w-4" />
                                </motion.button>
                              </Link>

                              {/* Social proof */}
                              <p className="text-center text-[10px] text-gray-600 mt-3">
                                ? Join thousands of artists already on Boostify
                              </p>
                            </div>
                              </>
                            )}
                          </div>
                        );
                      } else if (sectionId === 'analytics' && isOwnProfile) {
                        // -- Real platform data ------------------------------
                        const totalPlays  = (songs as unknown as Array<{plays?: number}>).reduce((s, song) => s + (song.plays  || 0), 0);
                        const totalViews  = (videos as unknown as Array<{views?: number}>).reduce((s, vid)  => s + (vid.views  || 0), 0);
                        const songCount   = songs.length;
                        const videoCount  = videos.length;
                        const productCount = products.length;
                        const followerCount = artist?.followers ?? 0;

                        // Profile completeness
                        const profileFields: [string, boolean][] = [
                          ['Profile photo',    !!(artist?.profileImage)],
                          ['Banner image',     !!(artist?.bannerImage)],
                          ['Bio',              !!(artist?.biography && artist.biography.length > 10)],
                          ['Genre',            !!(artist?.genre)],
                          ['Location',         !!(artist?.location)],
                          ['Instagram',        !!(artist?.instagram)],
                          ['Twitter / X',      !!(artist?.twitter)],
                          ['YouTube',          !!(artist?.youtube)],
                          ['Spotify',          !!(artist?.spotify)],
                          ['Music uploaded',   songCount > 0],
                          ['Video uploaded',   videoCount > 0],
                        ];
                        const completedFields = profileFields.filter(([, v]) => v).length;
                        const completionPct = Math.round((completedFields / profileFields.length) * 100);

                        const statItems = [
                          { label: 'Followers',  value: followerCount > 999 ? `${(followerCount/1000).toFixed(1)}K` : String(followerCount), icon: Users,      hex: colors.hexAccent },
                          { label: 'Songs',      value: String(songCount),    icon: Music2,     hex: colors.hexPrimary },
                          { label: 'Videos',     value: String(videoCount),   icon: VideoIcon,  hex: '#a78bfa' },
                          { label: 'Products',   value: String(productCount), icon: ShoppingBag,hex: '#34d399' },
                          { label: 'Total Plays', value: totalPlays > 999 ? `${(totalPlays/1000).toFixed(1)}K` : String(totalPlays),  icon: Headphones, hex: colors.hexAccent },
                          { label: 'Total Views', value: totalViews > 999 ? `${(totalViews/1000).toFixed(1)}K` : String(totalViews), icon: Eye,        hex: colors.hexPrimary },
                        ];

                        sectionElement = (
                          <div className={cardStyles} style={cardStyleInline}>
                            {renderSectionHeader(sectionId, Activity, 'Observatory')}
                            {sectionExpanded[sectionId] && (
                              <div className="space-y-4 pt-1">

                                {/* -- Stats grid -- */}
                                <div className="grid grid-cols-3 gap-2">
                                  {statItems.map(({ label, value, icon: Icon, hex }) => (
                                    <motion.div
                                      key={label}
                                      className="flex flex-col items-center justify-center p-3 rounded-xl text-center gap-1"
                                      style={{ background: `${hex}10`, border: `1px solid ${hex}25` }}
                                      whileHover={{ scale: 1.04 }}
                                    >
                                      <Icon className="h-4 w-4 mb-0.5" style={{ color: hex }} />
                                      <span className="text-base font-bold text-white leading-none">{value}</span>
                                      <span className="text-[10px] text-gray-400 leading-none">{label}</span>
                                    </motion.div>
                                  ))}
                                </div>

                                {/* -- Profile completeness -- */}
                                <div
                                  className="rounded-xl p-3 space-y-2"
                                  style={{ background: `${colors.hexPrimary}08`, border: `1px solid ${colors.hexBorder}` }}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                                      <BarChart3 className="h-3.5 w-3.5" style={{ color: colors.hexAccent }} />
                                      Profile Completeness
                                    </span>
                                    <span className="text-xs font-bold" style={{ color: completionPct >= 80 ? '#34d399' : completionPct >= 50 ? colors.hexAccent : '#f87171' }}>
                                      {completionPct}%
                                    </span>
                                  </div>
                                  {/* bar */}
                                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                                    <motion.div
                                      className="h-full rounded-full"
                                      style={{ background: `linear-gradient(90deg, ${colors.hexPrimary}, ${colors.hexAccent})` }}
                                      initial={{ width: 0 }}
                                      animate={{ width: `${completionPct}%` }}
                                      transition={{ duration: 0.8, ease: 'easeOut' }}
                                    />
                                  </div>
                                  {/* field checklist */}
                                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 pt-1">
                                    {profileFields.map(([label, done]) => (
                                      <div key={label} className="flex items-center gap-1.5 text-[10px]">
                                        <span className={done ? 'text-green-400' : 'text-gray-600'}>
                                          {done ? '?' : '?'}
                                        </span>
                                        <span className={done ? 'text-gray-300' : 'text-gray-600'}>{label}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                              </div>
                            )}
                          </div>
                        );
                      } else if (sectionId === 'earnings' && isOwnProfile) {
                        const earningsUserId = userProfile?.pgId ? Number(userProfile.pgId) : undefined;
                        sectionElement = (
                          <div className={cardStyles} style={cardStyleInline}>
                            {renderSectionHeader(sectionId, DollarSign, 'Earnings')}
                            {sectionExpanded[sectionId] && (
                              earningsUserId && earningsUserId > 0
                                ? <EarningsChart userId={earningsUserId} days={30} />
                                : <p className="text-center text-xs text-gray-600 py-6">Loading earnings data�</p>
                            )}
                          </div>
                        );
                      } else if (sectionId === 'crowdfunding' && isOwnProfile) {
                        sectionElement = (
                          <div className={cardStyles} style={cardStyleInline}>
                            {renderSectionHeader(sectionId, Target, 'Crowdfunding Campaign')}

                            {sectionExpanded[sectionId] && (
                              <CrowdfundingPanel colors={colors} />
                            )}
                          </div>
                        );
                      } else if (sectionId === 'sponsors' && isOwnProfile) {
                        sectionElement = (
                          <div className={cardStyles} style={cardStyleInline}>
                            {renderSectionHeader(sectionId, Handshake, 'Sponsor Acquisition')}

                            {sectionExpanded[sectionId] && (
                              <SponsorPanel artistId={artistId} artistName={userProfile?.artistName || userProfile?.username || 'Artist'} />
                            )}
                          </div>
                        );
                      } else if (sectionId === 'venueBooking' && isOwnProfile) {
                        sectionElement = (
                          <div className={cardStyles} style={cardStyleInline}>
                            {renderSectionHeader(sectionId, MapPin, 'Venue Booking')}

                            {sectionExpanded[sectionId] && (
                              <VenueBookingPanel artistId={artistId} artistName={userProfile?.artistName || userProfile?.username || 'Artist'} />
                            )}
                          </div>
                        );
                      } else if (sectionId === 'explicit-content') {
                        sectionElement = (
                          <ExplicitContentSection
                            artistId={artistId}
                            userId={user?.id || null}
                            isOwnProfile={isOwnProfile}
                            isExpanded={!!sectionExpanded[sectionId]}
                            onToggleExpand={() => setSectionExpanded(prev => ({ ...prev, [sectionId]: !prev[sectionId] }))}
                            colors={colors}
                            cardStyles={cardStyles}
                            cardStyleInline={cardStyleInline}
                            artistName={userProfile?.artistName || userProfile?.username || 'Artist'}
                          />
                        );
                      } else if (sectionId === 'aas-engine' && isOwnProfile) {
                        sectionElement = (
                          <AASEnginePanel
                            artistId={artistId}
                            pgId={userProfile?.pgId ? Number(userProfile.pgId) : undefined}
                            isOwnProfile={isOwnProfile}
                            isExpanded={!!sectionExpanded[sectionId]}
                            onToggleExpand={() => setSectionExpanded(prev => ({ ...prev, [sectionId]: !prev[sectionId] }))}
                            colors={colors}
                            cardStyles={cardStyles}
                            cardStyleInline={cardStyleInline}
                            artistName={userProfile?.artistName || userProfile?.username || 'Artist'}
                          />
                        );
                      } else if (sectionId === 'audience-engine' && isOwnProfile) {
                        const pgArtistId = Number(userProfile?.pgId || artistId) || 0;
                        sectionElement = (
                          <AudienceCaptureDashboard
                            artistId={pgArtistId}
                            artistName={userProfile?.artistName || userProfile?.displayName || userProfile?.username || artist?.name || 'Artist'}
                            genre={artist?.genre || (artist as any)?.genres?.[0] || ''}
                            biography={artist?.biography || userProfile?.biography || ''}
                            location={artist?.location || userProfile?.location || ''}
                            songs={songs?.map((s: any) => ({ id: s.id, title: s.title })) ?? []}
                            colors={colors as any}
                            cardStyles={cardStyles}
                            cardStyleInline={cardStyleInline}
                            isExpanded={!!sectionExpanded[sectionId]}
                            onToggleExpand={() => setSectionExpanded(prev => ({ ...prev, [sectionId]: !prev[sectionId] }))}
                          />
                        );
                      } else if (sectionId === 'viral-products' && isOwnProfile) {
                        sectionElement = (
                          <ViralProductGenerator
                            artistId={artistId}
                            pgId={userProfile?.pgId ? Number(userProfile.pgId) : undefined}
                            isOwnProfile={isOwnProfile}
                            isExpanded={!!sectionExpanded[sectionId]}
                            onToggleExpand={() => setSectionExpanded(prev => ({ ...prev, [sectionId]: !prev[sectionId] }))}
                            colors={colors as any}
                            cardStyles={cardStyles}
                            cardStyleInline={cardStyleInline}
                            artistName={userProfile?.artistName || userProfile?.username || 'Artist'}
                            artistImageUrl={artist?.profileImage}
                            artistGenre={artist?.genre || (artist as any)?.genres?.[0] || ''}
                            artistGender={(userProfile as any)?.artistGender || (initialArtistData as any)?.artistGender || 'unspecified'}
                          />
                        );
                      } else if (sectionId === 'business-plan') {
                        const pgArtistId = artist.pgId ? Number(artist.pgId) : (userProfile?.pgId ? Number(userProfile.pgId) : undefined);
                        sectionElement = pgArtistId && pgArtistId > 0 ? (
                          <BusinessPlanTeaser
                            pgArtistId={pgArtistId}
                            colors={colors}
                            cardStyles={cardStyles}
                            cardStyleInline={cardStyleInline}
                            isExpanded={!!sectionExpanded[sectionId]}
                            onToggleExpand={() => setSectionExpanded(prev => ({ ...prev, [sectionId]: !prev[sectionId] }))}
                          />
                        ) : (
                          <div className={cardStyles} style={cardStyleInline}>
                            {renderSectionHeader(sectionId, BarChart3, 'Commerce Blueprint')}
                            {sectionExpanded[sectionId] && (
                              <p className="text-center text-xs text-gray-600 py-6">Loading plan�</p>
                            )}
                          </div>
                        );
                      } else if (sectionId === 'brand-collabs' && isOwnProfile) {
                        sectionElement = (
                          <BrandCollabPanel
                            artistId={`${artistId}`}
                            isOwnProfile={isOwnProfile}
                            isExpanded={!!sectionExpanded[sectionId]}
                            onToggleExpand={() => setSectionExpanded(prev => ({ ...prev, [sectionId]: !prev[sectionId] }))}
                            colors={colors as any}
                            cardStyles={cardStyles}
                            cardStyleInline={cardStyleInline}
                            artistName={userProfile?.artistName || userProfile?.username || 'Artist'}
                            artistImageUrl={artist?.profileImage}
                            artistGenre={artist?.genre || ''}
                          />
                        );
                      } else if (sectionId === 'influencer-module' && isOwnProfile) {
                        sectionElement = (
                          <InfluencerModule
                            userId={userProfile?.pgId ? Number(userProfile.pgId) : 0}
                            artistName={userProfile?.artistName || userProfile?.username || 'Artist'}
                            isOwner={isOwnProfile}
                            colors={colors}
                            isExpanded={!!sectionExpanded[sectionId]}
                            onToggleExpand={() => setSectionExpanded(prev => ({ ...prev, [sectionId]: !prev[sectionId] }))}
                          />
                        );
                      } else if (sectionId === 'talk-to-me') {
                        sectionElement = (
                          <TalkToMeModule
                            userId={userProfile?.pgId ? Number(userProfile.pgId) : 0}
                            artistId={userProfile?.pgId ? Number(userProfile.pgId) : 0}
                            artistSlug={userProfile?.slug || ''}
                            artistName={userProfile?.artistName || userProfile?.displayName || userProfile?.name || artist?.name || userProfile?.username || 'Artist'}
                            avatarUrl={userProfile?.photoURL || userProfile?.profileImage || undefined}
                            isOwner={isOwnProfile}
                            colors={colors}
                            isExpanded={!!sectionExpanded[sectionId]}
                            onToggleExpand={() => setSectionExpanded(prev => ({ ...prev, [sectionId]: !prev[sectionId] }))}
                          />
                        );
                      } else if (sectionId === 'whatsapp-command-center' && isOwnProfile) {
                        sectionElement = (
                          <WhatsAppCommandCenter
                            artistId={String(userProfile?.pgId || artist?.pgId || artistId)}
                            artistName={artist?.name || userProfile?.artistName || userProfile?.username || 'Artist'}
                            artistImageUrl={artist?.profileImage || userProfile?.profileImage}
                          />
                        );
                      } else if (sectionId === 'telegram-command-center' && isOwnProfile) {
                        sectionElement = (
                          <TelegramCommandCenter
                            artistId={String(userProfile?.pgId || artist?.pgId || artistId)}
                            artistName={artist?.name || userProfile?.artistName || userProfile?.username || 'Artist'}
                            artistImageUrl={artist?.profileImage || userProfile?.profileImage}
                          />
                        );
                      } else if (sectionId === 'facebook-groups-command-center' && isOwnProfile) {
                        sectionElement = (
                          <FacebookGroupsCommandCenter
                            artistId={String(userProfile?.pgId || artist?.pgId || artistId)}
                            artistName={artist?.name || userProfile?.artistName || userProfile?.username || 'Artist'}
                            artistImageUrl={artist?.profileImage || userProfile?.profileImage}
                          />
                        );
                      } else if (sectionId === 'reddit-intelligence-center' && isOwnProfile) {
                        sectionElement = (
                          <RedditIntelligenceCenter
                            artistId={String(userProfile?.pgId || artist?.pgId || artistId)}
                            artistName={artist?.name || userProfile?.artistName || userProfile?.username || 'Artist'}
                            artistImageUrl={artist?.profileImage || userProfile?.profileImage}
                          />
                        );
                      } else if (sectionId === 'discord-fan-nation' && isOwnProfile) {
                        sectionElement = (
                          <DiscordFanNation
                            artistId={String(userProfile?.pgId || artist?.pgId || artistId)}
                            artistName={artist?.name || userProfile?.artistName || userProfile?.username || 'Artist'}
                            artistImageUrl={artist?.profileImage || userProfile?.profileImage}
                          />
                        );
                      } else if (sectionId === 'amazon-picks') {
                        const amazonArtistId = userProfile?.pgId ? Number(userProfile.pgId) : 0;
                        sectionElement = (
                          <div className={cardStyles} style={cardStyleInline}>
                            {renderSectionHeader(sectionId, ShoppingBag, 'Amazon Cultural Picks')}
                            {sectionExpanded[sectionId] && (
                              amazonArtistId > 0 ? (
                                <AmazonCuratedPicksModule
                                  artistId={amazonArtistId}
                                  artistName={userProfile?.artistName || userProfile?.username || 'Artist'}
                                  isOwner={isOwnProfile}
                                  colors={{
                                    hexAccent: colors.hexAccent,
                                    hexPrimary: colors.hexPrimary,
                                    hexBorder: colors.hexBorder,
                                  }}
                                />
                              ) : (
                                <p className="text-center text-xs text-gray-600 py-6">Loading�</p>
                              )
                            )}
                          </div>
                        );
                      } else if (sectionId === 'career-suite' && isOwnProfile) {
                        sectionElement = (
                          <motion.div
                            className={cardStyles}
                            style={{
                              ...cardStyleInline,
                              borderColor: 'rgba(34,211,238,0.45)',
                              backgroundImage: `linear-gradient(135deg, ${colors.hexAccent}18 0%, rgba(8,12,24,0.92) 45%, ${colors.hexPrimary}16 100%)`,
                              backgroundSize: '220% 220%',
                            }}
                            animate={{
                              boxShadow: [
                                '0 0 0 rgba(34,211,238,0)',
                                '0 0 24px rgba(34,211,238,0.32)',
                                '0 0 0 rgba(34,211,238,0)',
                              ],
                              backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                            }}
                            transition={{
                              duration: 4.5,
                              repeat: Infinity,
                              ease: 'easeInOut',
                            }}
                          >
                            {renderSectionHeader(sectionId, Brain, 'The Atelier')}
                            {sectionExpanded[sectionId] && (
                              <motion.div
                                style={{ padding: 4 }}
                                initial={{ opacity: 0.9, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.45, ease: 'easeOut' }}
                              >
                                <ArtistCareerSuite artistId={String(artistId)} />
                              </motion.div>
                            )}
                          </motion.div>
                        );
                      } else if (sectionId === 'artist-blueprint') {
                        sectionElement = (
                          <motion.div
                            className={cardStyles}
                            style={{
                              ...cardStyleInline,
                              borderColor: 'rgba(168,85,247,0.45)',
                              backgroundImage: `linear-gradient(135deg, rgba(88,28,135,0.25) 0%, rgba(8,12,24,0.94) 50%, rgba(59,7,100,0.18) 100%)`,
                              backgroundSize: '220% 220%',
                            }}
                            animate={{
                              boxShadow: [
                                '0 0 0 rgba(168,85,247,0)',
                                '0 0 28px rgba(168,85,247,0.28)',
                                '0 0 0 rgba(168,85,247,0)',
                              ],
                              backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                            }}
                            transition={{
                              duration: 5,
                              repeat: Infinity,
                              ease: 'easeInOut',
                            }}
                          >
                            {renderSectionHeader(sectionId, GraduationCap, 'Superstar Blueprint')}
                            {sectionExpanded[sectionId] && (
                              <motion.div
                                style={{ padding: 4 }}
                                initial={{ opacity: 0.9, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.45, ease: 'easeOut' }}
                              >
                                <ArtistBlueprintPanel
                                  artistId={Number(userProfile?.pgId) || parseInt(artistId, 10) || 0}
                                  artistName={artist?.name || userProfile?.displayName || 'Artist'}
                                  isOwnProfile={isOwnProfile}
                                />
                              </motion.div>
                            )}
                          </motion.div>
                        );
                      } else if (sectionId === 'artist-domain' && isOwnProfile) {
                        sectionElement = (
                          <div className={cardStyles} style={cardStyleInline}>
                            {renderSectionHeader(sectionId, Globe, 'My Domain')}
                            <div style={{ padding: 4 }}>
                              <ArtistDomainManager
                                artistId={Number(userProfile?.pgId) || parseInt(artistId, 10) || 0}
                              />
                            </div>
                          </div>
                        );
                      } else if (sectionId === 'hermes-agent' && isOwnProfile) {
                        sectionElement = (
                          <HermesAgentPanel
                            artistId={String(artistId)}
                            pgId={userProfile?.pgId ? Number(userProfile.pgId) : undefined}
                            isOwnProfile={isOwnProfile}
                            isExpanded={!!sectionExpanded[sectionId]}
                            onToggleExpand={() => setSectionExpanded(prev => ({ ...prev, [sectionId]: !prev[sectionId] }))}
                            colors={colors as any}
                            cardStyles={cardStyles}
                            cardStyleInline={cardStyleInline}
                            artistName={userProfile?.artistName || userProfile?.username || 'Artist'}
                          />
                        );
                      } else if (sectionId === 'electronic-press-kit') {
                        sectionElement = (
                          <div
                            className={cardStyles}
                            style={cardStyleInline}
                          >
                            {renderSectionHeader(sectionId, BookOpen, 'The Press Room')}
                            {sectionExpanded[sectionId] && (
                            <div style={{ padding: 4 }}>
                              <EpkSection
                                artistId={userProfile?.pgId ? Number(userProfile.pgId) : (artist?.pgId ? Number(artist.pgId) : artistId)}
                                isOwnProfile={isOwnProfile}
                                colors={{ hexAccent: colors.hexAccent, hexPrimary: colors.hexPrimary }}
                              />
                            </div>
                            )}
                          </div>
                        );
                      } else if (sectionId === 'agent-gateway') {
                        const pgArtistId = userProfile?.pgId ? Number(userProfile.pgId) : undefined;
                        sectionElement = pgArtistId && pgArtistId > 0 ? (
                          <AgentGatewayPanel
                            artistId={pgArtistId}
                            artistName={userProfile?.artistName || userProfile?.username || 'Artist'}
                            isOwner={!!isOwnProfile}
                            colors={colors}
                            cardStyles={cardStyles}
                            cardStyleInline={cardStyleInline}
                          />
                        ) : (
                          <div className={cardStyles} style={cardStyleInline}>
                            {renderSectionHeader(sectionId, Shield, 'The Gateway')}
                            {sectionExpanded[sectionId] && (
                              <p className="text-center text-xs text-gray-600 py-6">Loading agent gateway�</p>
                            )}
                          </div>
                        );
                      } else if (sectionId === 'hologram') {
                        sectionElement = (
                          <HologramProjectPanel
                            artistId={artistId}
                            artistName={userProfile?.artistName || userProfile?.username || artist?.name || 'Artist'}
                            artistGenre={artist?.genre || ''}
                            artistSlug={userProfile?.username || ''}
                            profileImage={artist?.profileImage || null}
                            isOwnProfile={!!isOwnProfile}
                            colors={colors}
                          />
                        );
                      } else if (sectionId === 'renaissance-studio') {
                        sectionElement = (
                          <RenaissanceStudioSection
                            isOwnProfile={!!isOwnProfile}
                            isExpanded={!!sectionExpanded[sectionId]}
                            onToggleExpand={() => setSectionExpanded(prev => ({ ...prev, [sectionId]: !prev[sectionId] }))}
                            colors={colors}
                            cardStyles={cardStyles}
                            cardStyleInline={cardStyleInline}
                            artistName={userProfile?.artistName || userProfile?.username || artist?.name || 'Artist'}
                            artistGenre={artist?.genre || ''}
                            songsCount={songs?.length || 0}
                          />
                        );
                      } else if (sectionId === 'observation-engine' && isOwnProfile) {
                        sectionElement = (
                          <ObservationEnginePanel
                            artistId={artistId}
                            pgId={artist?.pgId ? Number(artist.pgId) : (userProfile?.pgId ? Number(userProfile.pgId) : undefined)}
                            isOwnProfile={!!isOwnProfile}
                            isExpanded={!!sectionExpanded[sectionId]}
                            onToggleExpand={() => setSectionExpanded(prev => ({ ...prev, [sectionId]: !prev[sectionId] }))}
                            colors={colors}
                            cardStyles={cardStyles}
                            cardStyleInline={cardStyleInline}
                            artistName={userProfile?.artistName || userProfile?.username || artist?.name || 'Artist'}
                            artistGenre={artist?.genre || ''}
                            songsCount={songs?.length || 0}
                            location={artist?.location || userProfile?.location || ''}
                          />
                        );
                      } else if (sectionId === 'deep-brief' && isOwnProfile) {
                        sectionElement = (
                          <DeepBriefPanel
                            artistId={artistId}
                            isOwnProfile={!!isOwnProfile}
                            isExpanded={!!sectionExpanded[sectionId]}
                            onToggleExpand={() => setSectionExpanded(prev => ({ ...prev, [sectionId]: !prev[sectionId] }))}
                            colors={colors}
                            cardStyles={cardStyles}
                            cardStyleInline={cardStyleInline}
                            artistName={userProfile?.artistName || userProfile?.username || artist?.name || 'Artist'}
                          />
                        );
                      } else if (sectionId === 'emotional-studio' && isOwnProfile) {
                        sectionElement = (
                          <EmotionalStudioPanel
                            artistId={userProfile?.pgId ? Number(userProfile.pgId) : 0}
                            artistName={userProfile?.artistName || userProfile?.username || artist?.name || 'Artist'}
                            genre={artist?.genre || undefined}
                            isOwnProfile={!!isOwnProfile}
                            profileImage={artist?.profileImage || undefined}
                            colors={{ primary: colors.hexPrimary, secondary: colors.hexAccent, text: colors.textMuted, border: colors.hexBorder }}
                          />
                        );
                      } else if (sectionId === 'promo-clips' && isOwnProfile) {
                        sectionElement = (
                          <ArtistPromoClipsModule
                            artistId={artistId}
                            songs={songs}
                            isOwnProfile={!!isOwnProfile}
                            artistName={artist.name}
                            artistProfileImage={artist.profileImage}
                            artistGenre={artist.genre}
                            artistBiography={artist.biography}
                          />
                        );
                      } else if (sectionId === 'ai-video-studio' && isOwnProfile) {
                        sectionElement = (
                          <div className="relative px-3 py-4 sm:px-5 sm:py-6">
                            {/* Ambient glow */}
                            <div className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden" aria-hidden>
                              <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full opacity-[0.07]"
                                style={{ background: `radial-gradient(circle, ${colors.hexAccent}, transparent 70%)`, filter: 'blur(40px)' }} />
                              <div className="absolute -bottom-10 -right-10 w-56 h-56 rounded-full opacity-[0.05]"
                                style={{ background: `radial-gradient(circle, #8b5cf6, transparent 70%)`, filter: 'blur(40px)' }} />
                            </div>

                            {/* Elegant outer card */}
                            <div className="relative rounded-2xl overflow-hidden"
                              style={{
                                background: 'linear-gradient(160deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
                                border: `1px solid rgba(255,255,255,0.08)`,
                                boxShadow: `0 0 0 1px rgba(255,255,255,0.03), 0 8px 32px rgba(0,0,0,0.4)`,
                              }}>

                              {/* Top accent line */}
                              <div className="h-[2px] w-full"
                                style={{ background: `linear-gradient(90deg, transparent, ${colors.hexAccent}88, #8b5cf688, transparent)` }} />

                              <AIVideoStudio
                                artistId={artistId}
                                artistName={artist.name}
                                artistGenre={artist.genre}
                                songs={songs}
                                colors={colors}
                                isOwnProfile={!!isOwnProfile}
                              />
                            </div>
                          </div>
                        );
                      } else if (sectionId === 'ads-campaigns' && isOwnProfile) {
                        sectionElement = (
                          <div className="relative px-3 py-4 sm:px-5 sm:py-6">
                            {/* Ambient glow */}
                            <div className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden" aria-hidden>
                              <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full opacity-[0.07]"
                                style={{ background: `radial-gradient(circle, ${colors.hexAccent}, transparent 70%)`, filter: 'blur(40px)' }} />
                              <div className="absolute -bottom-10 -right-10 w-56 h-56 rounded-full opacity-[0.05]"
                                style={{ background: `radial-gradient(circle, #8b5cf6, transparent 70%)`, filter: 'blur(40px)' }} />
                            </div>

                            {/* Elegant outer card */}
                            <div className="relative rounded-2xl overflow-hidden"
                              style={{
                                background: 'linear-gradient(160deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
                                border: `1px solid rgba(255,255,255,0.08)`,
                                boxShadow: `0 0 0 1px rgba(255,255,255,0.03), 0 8px 32px rgba(0,0,0,0.4)`,
                              }}>

                              {/* Top accent line */}
                              <div className="h-[2px] w-full"
                                style={{ background: `linear-gradient(90deg, transparent, ${colors.hexAccent}88, #8b5cf688, transparent)` }} />

                              {/* Module label row */}
                              <div className="flex items-center gap-2.5 px-5 pt-4 pb-3"
                                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                  style={{ background: `linear-gradient(135deg, ${colors.hexAccent}33, #8b5cf633)`, border: `1px solid ${colors.hexAccent}33` }}>
                                  <Megaphone className="w-3.5 h-3.5" style={{ color: colors.hexAccent }} />
                                </div>
                                <div>
                                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">Campaign Manager</p>
                                </div>
                                <div className="ml-auto flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                  <span className="text-[10px] text-emerald-400/80 font-semibold uppercase tracking-wider">Active</span>
                                </div>
                              </div>

                              {/* Content */}
                              <div className="p-4 sm:p-5">
                                <AdsCampaignManager
                                  artistId={artistId}
                                  artistName={artist.name || userProfile?.artistName || userProfile?.username || 'Artist'}
                                  artistGenre={artist.genre || ''}
                                  artistProfileImageUrl={artist.profileImage || ''}
                                  accent={colors.hexAccent}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      } else if (sectionId === 'gamma-presentations' && isOwnProfile) {
                        sectionElement = (
                          <div className="p-4 sm:p-6">
                            <GammaPresentationsModule
                              artistId={artistId}
                              artistName={artist.name || userProfile?.artistName || userProfile?.username || 'Artist'}
                              artistGenre={artist.genre || ''}
                              artistBio={artist.biography || ''}
                              accent={colors.hexAccent}
                            />
                          </div>
                        );
                      } else if (sectionId === 'karaoke') {
                        sectionElement = (
                          <KaraokeModule
                            songs={songs.map(s => ({ id: s.id, title: s.title ?? s.name, audioUrl: s.audioUrl, coverArt: s.coverArt, duration: s.duration, genre: s.genre, lyrics: (s as any).lyrics }))}
                            artistName={artist.name || userProfile?.artistName || userProfile?.username || 'Artist'}
                            artistProfileImage={artist.profileImage || userProfile?.profileImage}
                            isOwnProfile={!!isOwnProfile}
                            currentlyPlayingSongId={playingSongId}
                          />
                        );
                      } else if (sectionId === 'lyrics-video') {
                        sectionElement = (
                          <div
                            className="rounded-2xl overflow-hidden"
                            style={{
                              background: "rgba(255,255,255,0.015)",
                              border: `1px solid ${colors.hexAccent}22`,
                              backdropFilter: "blur(20px)",
                              boxShadow: `0 0 40px ${colors.hexAccent}08`,
                            }}
                          >
                            <div
                              className="flex items-center gap-3 px-6 py-5"
                              style={{
                                background: `linear-gradient(135deg, ${colors.hexAccent}14 0%, transparent 60%)`,
                                borderBottom: `1px solid ${colors.hexAccent}1a`,
                              }}
                            >
                              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ background: `${colors.hexAccent}20`, border: `1px solid ${colors.hexAccent}30` }}>
                                <Clapperboard className="w-5 h-5" style={{ color: colors.hexAccent }} />
                              </div>
                              <div>
                                <h2 className="text-base font-black text-white uppercase tracking-[0.12em]">Lyrics Video Studio</h2>
                                <p className="text-[11px] text-zinc-500 mt-0.5">AI Transcription · Karaoke 1920×1080 · YouTube Ready</p>
                              </div>
                            </div>
                            <div className="p-5">
                              <LyricsVideoModule
                                songs={songs.map(s => ({ id: s.id, title: s.title ?? s.name ?? '', audioUrl: s.audioUrl ?? '', coverArt: s.coverArt, duration: s.duration }))}
                                artistId={userProfile?.pgId ? Number(userProfile.pgId) : undefined}
                                artistName={artist.name || userProfile?.artistName || userProfile?.username || 'Artist'}
                                isOwner={!!isOwnProfile}
                              />
                            </div>
                          </div>
                        );
                      } else if (sectionId === 'avatar-talk') {
                        sectionElement = (
                          <AvatarTalkModule
                            artistId={artistId}
                            artistName={artist.name || userProfile?.artistName || userProfile?.username || 'Artist'}
                            artistProfileImage={artist.profileImage || userProfile?.profileImage}
                            isOwnProfile={!!isOwnProfile}
                            colors={{ hexAccent: colors.hexAccent, hexPrimary: colors.hexPrimary, hexBorder: colors.hexBorder }}
                          />
                        );
                      } else if (sectionId === 'my-universe') {
                        const ownerPgId = userProfile?.pgId ? Number(userProfile.pgId) : 0;
                        sectionElement = ownerPgId > 0 ? (
                          <div className={cardStyles} style={cardStyleInline}>
                            {renderSectionHeader(sectionId, Globe, 'My Universe')}
                            {sectionExpanded[sectionId] && (
                              <div style={{ padding: 4 }}>
                                <MyUniverseModule ownerPgId={ownerPgId} isOwnProfile={!!isOwnProfile} />
                              </div>
                            )}
                          </div>
                        ) : null;
                      } else if (sectionId === 'vinyl-records') {
                        sectionElement = (
                          <VinylRecordsHub
                            artist={artist}
                            colors={colors}
                            isOwner={!!isOwnProfile}
                          />
                        );
                      } else if (sectionId === 'vinyl-editions') {
                        sectionElement = null;
                      } else if (sectionId === 'fashion-store') {
                        sectionElement = (
                          <FashionVirtualStore
                            artistId={artist.pgId}
                            artistData={artist}
                            isOwner={isOwnProfile}
                            colors={colors}
                            cardStyles={cardStyles}
                            cardStyleInline={cardStyleInline}
                          />
                        );
                      } else if (sectionId === 'art-gallery') {
                        sectionElement = (
                          <ArtGalleryModule
                            artistId={artist.pgId}
                            artistName={artist.name}
                            isOwner={!!isOwnProfile}
                            colors={colors}
                            cardStyles={cardStyles}
                            cardStyleInline={cardStyleInline}
                          />
                        );
                      } else if (sectionId === 'smart-merch') {
                        sectionElement = (
                          <SmartMerchModule
                            artistId={artist.pgId}
                            artistName={artist.name}
                            isOwner={!!isOwnProfile}
                            colors={colors}
                            cardStyles={cardStyles}
                            cardStyleInline={cardStyleInline}
                          />
                        );
                      }

                const sectionModuleKey = profileSectionToModuleKey[sectionId];
                if (sectionElement && isOwnProfile && sectionModuleKey) {
                  const sectionDef = allSections[sectionId as keyof typeof allSections];
                  const mod = getModule(sectionModuleKey);

                  if (isModuleAccessLoading) {
                    sectionElement = (
                      <div className={cardStyles} style={cardStyleInline}>
                        {renderSectionHeader(sectionId, sectionDef?.icon || Lock, sectionDef?.name || sectionId)}
                        <div className="text-center text-xs text-gray-500 py-8">Verificando desbloqueo…</div>
                      </div>
                    );
                  } else if (!hasProfileModuleAccess(sectionId)) {
                    const unlockLabel = mod ? `$${(mod.unlockPriceCents / 100).toFixed(0)}` : '$?';
                    sectionElement = (
                      <div className={cardStyles} style={cardStyleInline}>
                        {renderSectionHeader(sectionId, sectionDef?.icon || Lock, sectionDef?.name || sectionId)}
                        <div className="px-4 pb-5 pt-2">
                          <div
                            className="rounded-2xl border p-4 sm:p-5"
                            style={{
                              borderColor: `${colors.hexAccent}55`,
                              background: `linear-gradient(135deg, ${colors.hexPrimary}18, ${colors.hexAccent}14)`,
                            }}
                            data-testid={`profile-module-paywall-${sectionId}`}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{
                                  background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
                                  color: 'white',
                                }}
                              >
                                <Lock className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="text-sm font-bold text-white uppercase tracking-wide">Módulo premium bloqueado</h4>
                                <p className="text-xs text-white/70 mt-1">
                                  Desbloquea este módulo con un pago único de por vida.
                                </p>
                                <p className="text-[11px] text-white/50 mt-1">
                                  Solo admin tiene acceso total a todos los módulos.
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleProfileModuleUnlockCheckout(sectionId)}
                              disabled={profileModuleCheckoutLoading === sectionId}
                              className="mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-all disabled:opacity-60"
                              style={{
                                background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
                              }}
                              data-testid={`button-profile-module-unlock-${sectionId}`}
                            >
                              {profileModuleCheckoutLoading === sectionId
                                ? 'Redirigiendo a pago seguro…'
                                : `Desbloquear por ${unlockLabel}`}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }
                }

                if (!sectionElement) return null;

                // If this section is in fullscreen, render via portal as an
                // immersive overlay (works on mobile and desktop).
                if (fullscreenSectionId === sectionId && typeof document !== 'undefined') {
                  const overlay = (
                    <div
                      className="fixed inset-0 z-[55] flex flex-col bg-[#08080c]/95 backdrop-blur-2xl"
                      data-testid={`fullscreen-overlay-${sectionId}`}
                      style={{
                        paddingLeft: 'env(safe-area-inset-left, 0px)',
                        paddingRight: 'env(safe-area-inset-right, 0px)',
                      }}
                    >
                      <div
                        className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 sm:px-6 border-b"
                        style={{
                          background: 'rgba(8,8,12,0.85)',
                          borderColor: `${colors.hexAccent}26`,
                          paddingTop:
                            'max(0.75rem, calc(env(safe-area-inset-top, 0px) + 0.5rem))',
                          paddingBottom: '0.75rem',
                        }}
                      >
                        <div className="flex items-center gap-2 text-white/90 text-sm font-semibold">
                          <span
                            className="inline-flex items-center justify-center w-7 h-7 rounded-md"
                            style={{ backgroundColor: `${colors.hexAccent}1f`, color: colors.hexAccent }}
                          >
                            <Maximize2 className="h-4 w-4" />
                          </span>
                          Fullscreen
                        </div>
                        <button
                          type="button"
                          onClick={() => setFullscreenSectionId(null)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-105"
                          style={{
                            backgroundColor: `${colors.hexAccent}20`,
                            color: colors.hexAccent,
                            border: `1px solid ${colors.hexAccent}40`,
                          }}
                          title="Close (Esc)"
                          data-testid={`button-close-fullscreen-${sectionId}`}
                        >
                          <Minimize2 className="h-4 w-4" />
                          <span>Close</span>
                        </button>
                      </div>
                      <div
                        className="flex-1 overflow-y-auto px-3 sm:px-6 pt-4"
                        style={{
                          paddingBottom:
                            'max(8rem, calc(env(safe-area-inset-bottom, 0px) + 6rem))',
                        }}
                      >
                        <div className="max-w-7xl mx-auto">{sectionElement}</div>
                      </div>
                    </div>
                  );
                  // Render an inline placeholder where the section would be,
                  // and the overlay via portal so it covers the whole viewport.
                  return (
                    <div key={sectionId} id={`section-${sectionId}`}>
                      <div
                        className="rounded-2xl border border-dashed p-6 text-center text-sm text-white/60"
                        style={{ borderColor: `${colors.hexAccent}40` }}
                      >
                        Module is open in fullscreen
                      </div>
                      {createPortal(overlay, document.body)}
                    </div>
                  );
                }

                // Wrap premium modules with PremiumGate for free-tier users
                if (isOwnProfile && tierLimits.isModuleLocked(sectionId)) {
                  sectionElement = (
                    <PremiumGate
                      locked={true}
                      featureName={allSections[sectionId as keyof typeof allSections]?.name || sectionId}
                      accentColor={colors.hexAccent}
                    >
                      {sectionElement}
                    </PremiumGate>
                  );
                }

                // Add usage guide below each module for logged-in profile owners
                if (isOwnProfile) {
                  sectionElement = (
                    <>
                      {sectionElement}
                      <ModuleGuide moduleId={sectionId} accentColor={colors.hexAccent} />
                    </>
                  );
                }

                // Wrap with section ID for scroll targeting + return-to-CC button
                const sectionLabel = allSections[sectionId as keyof typeof allSections]?.name || sectionId;
                sectionElement = (
                  <div id={`section-${sectionId}`} className="relative">
                    {/* Universal Fullscreen toggle � top-left, shown on every module */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setSectionExpanded(prev => ({ ...prev, [sectionId]: true }));
                        setFullscreenSectionId(prev => (prev === sectionId ? null : sectionId));
                      }}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        setSectionExpanded(prev => ({ ...prev, [sectionId]: true }));
                        setFullscreenSectionId(prev => (prev === sectionId ? null : sectionId));
                      }}
                      className={`absolute -top-1 left-2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-semibold uppercase tracking-wider backdrop-blur-xl border transition-all duration-300 hover:scale-105 active:scale-95 hover:opacity-100 ${chromeVisible ? 'opacity-70' : 'opacity-0 pointer-events-none'}`}
                      style={{
                        background: 'rgba(0,0,0,0.6)',
                        borderColor: `${colors.hexAccent}30`,
                        color: colors.hexAccent,
                        touchAction: 'manipulation',
                        WebkitTapHighlightColor: 'transparent',
                        minWidth: 44,
                        minHeight: 36,
                        pointerEvents: chromeVisible ? 'auto' : 'none',
                      }}
                      title={fullscreenSectionId === sectionId ? 'Exit fullscreen (Esc)' : 'Open fullscreen'}
                      data-testid={`button-fullscreen-${sectionId}`}
                      aria-hidden={!chromeVisible}
                      tabIndex={chromeVisible ? 0 : -1}
                    >
                      {fullscreenSectionId === sectionId ? (
                        <Minimize2 className="w-3.5 h-3.5" />
                      ) : (
                        <Maximize2 className="w-3.5 h-3.5" />
                      )}
                      <span>Full</span>
                    </button>
                    {sectionId !== 'social-hub' && sectionVisibility['social-hub'] && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          const cc = document.getElementById('section-social-hub');
                          if (cc) cc.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }}
                        onTouchEnd={(e) => {
                          e.preventDefault();
                          const cc = document.getElementById('section-social-hub');
                          if (cc) cc.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }}
                        className={`absolute -top-1 right-2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-semibold uppercase tracking-wider backdrop-blur-xl border transition-all duration-300 hover:scale-105 active:scale-95 hover:opacity-100 ${chromeVisible ? 'opacity-70' : 'opacity-0 pointer-events-none'}`}
                        style={{
                          background: 'rgba(0,0,0,0.6)',
                          borderColor: `${colors.hexAccent}30`,
                          color: colors.hexAccent,
                          touchAction: 'manipulation',
                          WebkitTapHighlightColor: 'transparent',
                          minWidth: 44,
                          minHeight: 36,
                          pointerEvents: chromeVisible ? 'auto' : 'none',
                        }}
                        title="Back to Command Center"
                      >
                        <Layout className="w-3.5 h-3.5" />
                        <span>CC</span>
                      </button>
                    )}
                    {sectionElement}
                  </div>
                );

                // Wrap the final assembled element in an error boundary so a
                // single broken module never white-screens the whole profile.
                sectionElement = (
                  <ProfileSectionErrorBoundary sectionId={sectionId}>
                    {sectionElement}
                  </ProfileSectionErrorBoundary>
                );

                return (isOwnProfile && !isStatic) ? (
                  <Draggable key={sectionId} draggableId={`inline-${sectionId}`} index={filteredIndex} isDragDisabled={tierLimits.isFree}>
                    {(dragProvided, dragSnapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        className={`relative group/drag ${dragSnapshot.isDragging ? 'z-50 opacity-90 scale-[1.01]' : ''}`}
                        style={dragProvided.draggableProps.style}
                      >
                        {/* Drag handle bar � appears on hover at the top (hidden for free tier) */}
                        {!tierLimits.isFree && (
                        <div
                          {...dragProvided.dragHandleProps}
                          className="flex items-center justify-center gap-2 py-1.5 -mb-2 rounded-t-2xl opacity-0 group-hover/drag:opacity-100 transition-all duration-200 cursor-grab active:cursor-grabbing select-none"
                          style={{ background: `linear-gradient(135deg, ${colors.hexPrimary}40, ${colors.hexAccent}30)` }}
                        >
                          <GripVertical className="h-4 w-4" style={{ color: colors.hexAccent }} />
                          <span className="text-[10px] font-medium tracking-wider uppercase" style={{ color: colors.hexAccent }}>
                            Drag to reorder
                          </span>
                          <GripVertical className="h-4 w-4" style={{ color: colors.hexAccent }} />
                        </div>
                        )}
                        {sectionElement}
                      </div>
                    )}
                  </Draggable>
                ) : (
                  <div key={sectionId}>
                    {sectionElement}
                  </div>
                );
              };
              sectionRendererRef.current = renderSectionCard;
              const leftSectionIds = sectionOrder.filter(id => sectionVisibility[id] && sideOf(id) !== 'right');
              return leftSectionIds.map((id, i) => renderSectionCard(id, i));
            })()}
              {droppableProvided.placeholder}
            </div>
          )}
        </Droppable>

          {/* Slot for widgets relocated to the LEFT column (portaled at bottom) */}
          <div ref={leftRelocSlotRef} className="flex flex-col gap-4 empty:hidden" />

          </section>

          {/* Columna Derecha */}
          <section className="flex flex-col gap-4 min-w-0">
        <Droppable droppableId="inline-sections-right" isDropDisabled={!isOwnProfile || tierLimits.isFree}>
          {(rightDropProvided) => (
            <div
              ref={rightDropProvided.innerRef}
              {...rightDropProvided.droppableProps}
              className="flex flex-col gap-4"
            >
            {(() => {
              const renderWidgetCard = (widgetId: string, widgetIndex: number, isStatic: boolean = false): React.ReactNode => {
              const widgetName = rightWidgets[widgetId]?.name || widgetId;
              const isExpanded = rightExpanded[widgetId] !== false;
              let widgetElement: React.ReactNode = null;

              if (widgetId === 'qr-card') {
                widgetElement = (
                  <div className={cardStyles} style={cardStyleInline}>
                    <ArtistCard 
                      artist={artist}
                      colors={colors}
                      profileUrl={`${window.location.origin}/artist/${userProfile?.slug || artistId}`}
                    />
                  </div>
                );
              }

              if (widgetId === 'economic-engine') {
                widgetElement = (
                  <EconomicEngineDashboard
                    artistId={String(userProfile?.pgId || artistId)}
                    colors={colors}
                    isAdmin={userProfile?.role === 'admin' || isOwnProfile}
                  />
                );
              }

              if (widgetId === 'crypto-community') {
                widgetElement = (
                  <CryptoCommunityDashboard
                    artistId={String(userProfile?.pgId || artistId)}
                    colors={colors}
                    isAdmin={userProfile?.role === 'admin' || isOwnProfile}
                  />
                );
              }

              if (widgetId === 'physical-cards') {
                widgetElement = (
                  <PhysicalCardsWidget 
                    artist={artist} 
                    colors={colors} 
                    profileUrl={`${window.location.origin}/artist/${userProfile?.slug || artistId}`}
                    cardStyles={cardStyles}
                  />
                );
              }

              if (widgetId === 'statistics') {
                widgetElement = (
                  <div className={cardStyles} style={cardStyleInline}>
                    <div className="text-base font-semibold mb-4 transition-colors duration-500" style={{ color: colors.hexAccent }}>Profile Statistics</div>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
                      <motion.div className="text-center p-2 sm:p-3 rounded-lg" style={{ backgroundColor: `${colors.hexPrimary}15`, borderColor: colors.hexBorder, borderWidth: '1px' }} whileHover={{ scale: 1.05 }} transition={{ duration: 0.2 }}>
                        <Music2 className="h-4 sm:h-5 w-4 sm:w-5 mx-auto mb-1" style={{ color: colors.hexAccent }} />
                        <div className="text-xl sm:text-2xl font-bold text-white">{songs.length}</div>
                        <div className="text-[10px] sm:text-xs text-gray-400">Canciones</div>
                      </motion.div>
                      <motion.div className="text-center p-2 sm:p-3 rounded-lg" style={{ backgroundColor: `${colors.hexPrimary}15`, borderColor: colors.hexBorder, borderWidth: '1px' }} whileHover={{ scale: 1.05 }} transition={{ duration: 0.2 }}>
                        <VideoIcon className="h-4 sm:h-5 w-4 sm:w-5 mx-auto mb-1" style={{ color: colors.hexAccent }} />
                        <div className="text-xl sm:text-2xl font-bold text-white">{videos.length}</div>
                        <div className="text-[10px] sm:text-xs text-gray-400">Videos</div>
                      </motion.div>
                      <motion.div className="text-center p-2 sm:p-3 rounded-lg" style={{ backgroundColor: `${colors.hexPrimary}15`, borderColor: colors.hexBorder, borderWidth: '1px' }} whileHover={{ scale: 1.05 }} transition={{ duration: 0.2 }}>
                        <Users className="h-4 sm:h-5 w-4 sm:w-5 mx-auto mb-1" style={{ color: colors.hexAccent }} />
                        <div className="text-xl sm:text-2xl font-bold text-white">{artist.followers > 1000 ? `${(artist.followers / 1000).toFixed(1)}K` : artist.followers}</div>
                        <div className="text-[10px] sm:text-xs text-gray-400">Followers</div>
                      </motion.div>
                    </div>
                    <div className="space-y-3">
                      <div className="text-sm font-medium text-gray-300">Completion Level</div>
                      {(() => {
                        let s = 0;
                        if (artist.profileImage) s += 20;
                        if (artist.bannerImage) s += 20;
                        if (artist.biography) s += 15;
                        if (songs.length > 0) s += 15;
                        if (videos.length > 0) s += 15;
                        if (artist.instagram || artist.twitter || artist.youtube) s += 15;
                        const pct = Math.max(0, Math.min(100, s));
                        const radius = 56;
                        const circumference = 2 * Math.PI * radius;
                        const dash = (pct / 100) * circumference;
                        return (
                          <>
                            <div className="h-32 flex items-center justify-center">
                              <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
                                <circle
                                  cx="64"
                                  cy="64"
                                  r={radius}
                                  fill="none"
                                  stroke="#1a1a1a"
                                  strokeWidth="12"
                                />
                                <circle
                                  cx="64"
                                  cy="64"
                                  r={radius}
                                  fill="none"
                                  stroke={colors.hexPrimary}
                                  strokeWidth="12"
                                  strokeLinecap="round"
                                  strokeDasharray={`${dash} ${circumference}`}
                                />
                              </svg>
                            </div>
                            <div className="flex items-center justify-center gap-2">
                              <div className="text-3xl font-bold" style={{ color: colors.hexAccent }}>
                                {pct}%
                              </div>
                              <div className="text-sm text-gray-400">{t('profile.analytics.complete')}</div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                );
              }

              if (widgetId === 'tokenized-music') {
                const tokenArtistId = artist.pgId || userProfile?.pgId || artistId;
                widgetElement = (
                  <TokenizedMusicView
                    artistId={tokenArtistId}
                    postgresId={(artist.pgId || userProfile?.pgId || null) as number | null}
                    artistName={artist.name || (artist as any)?.artistName}
                    isAIGenerated={(artist as any)?.isAIGenerated || false}
                  />
                );
              }

              if (widgetId === 'information') {
                const biographyText: string = typeof artist.biography === 'string' ? artist.biography.trim() : '';
                const hasLongBiography = biographyText.length > 420;
                const biographyParagraphs: string[] = biographyText
                  .split(/\n{2,}|\r\n\r\n/)
                  .map((p) => p.trim())
                  .filter(Boolean);

                widgetElement = (
                  <div className={cardStyles} style={cardStyleInline}>
                    <div className="relative overflow-hidden rounded-xl p-3" style={{ background: `linear-gradient(145deg, ${colors.hexPrimary}14, rgba(0,0,0,0.45) 45%, ${colors.hexAccent}0f)` }}>
                      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${colors.hexAccent}90, transparent)` }} />
                      <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${colors.hexPrimary}75, transparent)` }} />

                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div>
                          <div
                            className="text-[11px] uppercase tracking-[0.22em] font-semibold"
                            style={{ color: `${colors.hexAccent}cc` }}
                          >
                            Artist Profile
                          </div>
                          <div
                            className="text-lg sm:text-xl font-bold leading-tight"
                            style={{
                              backgroundImage: `linear-gradient(90deg, ${colors.hexAccent}, ${colors.hexPrimary})`,
                              WebkitBackgroundClip: 'text',
                              backgroundClip: 'text',
                              color: 'transparent',
                            }}
                          >
                            Information
                          </div>
                        </div>
                        <Info className="h-5 w-5 flex-shrink-0" style={{ color: `${colors.hexAccent}d0` }} />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                        {artist.genre && (
                          <div className="rounded-lg px-2.5 py-2" style={{ background: '#0f1117aa', border: `1px solid ${colors.hexBorder}50` }}>
                            <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Genre</div>
                            <div className="flex items-center gap-2">
                              <Music2 className="h-3.5 w-3.5" style={{ color: colors.hexAccent }} />
                              <span className="text-sm text-zinc-200 font-medium">{artist.genre}</span>
                            </div>
                          </div>
                        )}

                        {formatLocation(artist.location) && (
                          <div className="rounded-lg px-2.5 py-2" style={{ background: '#0f1117aa', border: `1px solid ${colors.hexBorder}50` }}>
                            <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Location</div>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-3.5 w-3.5" style={{ color: colors.hexAccent }} />
                              <span className="text-sm text-zinc-200 font-medium">{formatLocation(artist.location)}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {artist.website && (
                        <div className="rounded-lg px-2.5 py-2 mb-3" style={{ background: '#0f1117aa', border: `1px solid ${colors.hexBorder}50` }}>
                          <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Official Website</div>
                          <a
                            href={artist.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline break-all"
                            style={{ color: colors.hexAccent }}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            {artist.website}
                          </a>
                        </div>
                      )}

                      <div className="pt-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${colors.hexAccent}55, transparent)` }} />
                          <div className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: `${colors.hexAccent}dd` }}>
                            Biography
                          </div>
                          <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, transparent, ${colors.hexPrimary}65)` }} />
                        </div>

                        {biographyText ? (
                          <>
                            <div
                              className={`relative text-sm text-zinc-200 leading-relaxed whitespace-pre-line ${!isInformationBioExpanded && hasLongBiography ? 'line-clamp-6' : ''}`}
                              style={{ textWrap: 'pretty' }}
                            >
                              {biographyParagraphs.length > 0
                                ? biographyParagraphs.map((paragraph, idx) => (
                                    <p key={`bio-paragraph-${idx}`} className={idx > 0 ? 'mt-2.5' : ''}>
                                      {paragraph}
                                    </p>
                                  ))
                                : biographyText}
                            </div>

                            {!isInformationBioExpanded && hasLongBiography && (
                              <div
                                className="-mt-10 h-10"
                                style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0), rgba(10,12,16,0.95))' }}
                              />
                            )}

                            {hasLongBiography && (
                              <button
                                onClick={() => setIsInformationBioExpanded((prev) => !prev)}
                                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-all"
                                style={{
                                  color: colors.hexAccent,
                                  background: `${colors.hexAccent}16`,
                                  border: `1px solid ${colors.hexAccent}45`,
                                }}
                              >
                                {isInformationBioExpanded ? 'Read less' : 'Read more'}
                                {isInformationBioExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              </button>
                            )}
                          </>
                        ) : (
                          <div className="text-sm text-zinc-500 italic">No biography available yet.</div>
                        )}
                      </div>

                      <div className="mt-3 flex items-center gap-2 text-[10px] text-zinc-500">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors.hexAccent }} />
                        <span>Professional artist dossier</span>
                        <span className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${colors.hexBorder}, transparent)` }} />
                        <span className="tracking-wide uppercase">Boostify</span>
                      </div>
                    </div>
                  </div>
                );
              }

              if (widgetId === 'social-media') {
                widgetElement = (
                  <div className={cardStyles} style={cardStyleInline}>
                    <div className="text-base font-semibold mb-3 transition-colors duration-500" style={{ color: colors.hexAccent }}>Social Media</div>
                    <div className="space-y-2">
                      {artist.instagram && (
                        <a href={`https://instagram.com/${artist.instagram}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-800/50 transition-colors" style={cardStyleInline}>
                          <span className="text-sm">?? Instagram</span>
                          <span className="text-sm ml-auto" style={{ color: colors.hexAccent }}>@{artist.instagram}</span>
                        </a>
                      )}
                      {artist.twitter && (
                        <a href={`https://x.com/${artist.twitter}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-800/50 transition-colors" style={cardStyleInline}>
                          <span className="text-sm">?? X (Twitter)</span>
                          <span className="text-sm ml-auto" style={{ color: colors.hexAccent }}>@{artist.twitter}</span>
                        </a>
                      )}
                      {artist.youtube && (
                        <a href={artist.youtube} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-800/50 transition-colors" style={cardStyleInline}>
                          <span className="text-sm">?? YouTube</span>
                          <span className="text-sm ml-auto" style={{ color: colors.hexAccent }}>View Channel</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              }

              if (widgetId === 'spotify') {
                widgetElement = (
                  <div className={cardStyles} style={cardStyleInline} data-testid="spotify-widget">
                    <div className="text-base font-semibold mb-3 transition-colors duration-500 flex items-center gap-2" style={{ color: colors.hexAccent }}>
                      <Music className="h-5 w-5" />
                      Spotify
                    </div>
                    <div className="mb-3 md:hidden">
                      <a href={artist.spotify} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-full text-sm font-bold shadow-xl hover:shadow-2xl transition-all active:scale-95" style={{ backgroundColor: '#1DB954', color: 'white' }} data-testid="button-open-spotify-mobile">
                        <Music className="h-5 w-5" />
                        <span className="font-semibold">Abrir en Spotify</span>
                      </a>
                    </div>
                    <div className="rounded-lg overflow-hidden w-full relative" style={{ minHeight: '152px', background: `linear-gradient(135deg, ${colors.hexPrimary}15 0%, rgba(0,0,0,0.4) 25%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.4) 75%, ${colors.hexAccent}10 100%)`, position: 'relative' }}>
                      <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: `radial-gradient(circle at 20% 30%, ${colors.hexPrimary}40 0%, transparent 50%), radial-gradient(circle at 80% 70%, ${colors.hexAccent}30 0%, transparent 50%)` }} />
                      <iframe style={{ borderRadius: '12px', border: 'none', display: 'block', background: 'transparent', position: 'relative', zIndex: 1, width: '100%' }} src={getSpotifyEmbedUrl(artist.spotify) || ''} width="100%" height="352" frameBorder="0" allowFullScreen allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" title="Spotify Artist Profile" className="w-full h-[152px] md:h-[352px]" data-testid="spotify-iframe" />
                      <div className="hidden md:flex md:absolute md:bottom-3 md:right-3 justify-end" style={{ position: 'relative', zIndex: 2 }}>
                        <a href={artist.spotify} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-3 rounded-full text-sm font-bold shadow-xl hover:shadow-2xl transition-all hover:scale-105" style={{ backgroundColor: '#1DB954', color: 'white' }} data-testid="button-open-spotify">
                          <Music className="h-5 w-5" />
                          <span className="font-semibold">Open on Spotify</span>
                        </a>
                      </div>
                    </div>
                  </div>
                );
              }

              if (widgetId === 'premium-tools') {
                const premiumLinks = [
                  { href: '/instagram-boost', icon: Instagram, title: 'My Community Manager', desc: 'Boost your Instagram presence with AI-powered engagement' },
                  { href: '/contracts', icon: Scale, title: 'My Lawyer', desc: 'Generate and manage music contracts with AI legal assistance' },
                  { href: '/producer-tools', icon: Headphones, title: 'My Music Producer', desc: 'Professional production tools and AI music generation' },
                  { href: '/education', icon: GraduationCap, title: 'Education', desc: 'Master your craft with courses and tutorials' },
                  { href: '/manager-tools', icon: Briefcase, title: 'My Manager', desc: 'Manage bookings, schedules, and career opportunities' },
                  { href: '/ai-advisors', icon: Eye, title: 'My Image Supervisor', desc: 'AI-powered brand and visual identity management' },
                  { href: '/pr', icon: Megaphone, title: 'My PR', desc: 'Press releases, media outreach, and publicity campaigns' },
                  { href: '/music-video-creator', icon: Film, title: 'My Video Director', desc: 'Create professional music videos with AI-powered direction' },
                  { href: '/contacts', icon: Globe, title: 'Industry Outreach', desc: 'Connect with labels, publishers & sync opportunities' },
                ];
                widgetElement = (
                  <div className={cardStyles} style={cardStyleInline}>
                    <div className="flex items-center justify-between mb-6">
                      <div className="text-lg font-bold transition-colors duration-500 flex items-center gap-2" style={{ color: colors.hexAccent }}>
                        <Zap className="h-6 w-6" />
                        Premium Tools
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30">
                        <Crown className="h-3.5 w-3.5 text-yellow-500" />
                        <span className="text-xs font-bold text-yellow-500">PRO</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {premiumLinks.map(item => (
                        <Link key={item.href} href={item.href}>
                          <div className="group relative overflow-hidden rounded-xl p-4 border transition-all duration-300 hover:scale-[1.02] hover:shadow-lg cursor-pointer" style={{ borderColor: colors.hexBorder, background: 'linear-gradient(135deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.2) 100%)' }}>
                            <div className="absolute top-0 right-0 w-32 h-32 opacity-10 group-hover:opacity-20 transition-opacity duration-300" style={{ background: `radial-gradient(circle, ${colors.hexPrimary} 0%, transparent 70%)` }} />
                            <div className="flex items-start gap-3 relative z-10">
                              <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300" style={{ background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`, boxShadow: `0 4px 12px ${colors.hexPrimary}40` }}>
                                <item.icon className="h-6 w-6 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-white font-semibold text-sm mb-1 group-hover:text-opacity-90 transition-colors">{item.title}</h3>
                                <p className="text-gray-400 text-xs leading-relaxed">{item.desc}</p>
                              </div>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 border-t" style={{ borderColor: colors.hexBorder }}>
                      <p className="text-xs text-center text-gray-500">All tools require an active premium subscription</p>
                    </div>
                  </div>
                );
              }

              if (widgetId === 'upcoming-shows') {
                const safeConcertEvents = Array.isArray(concertEvents) ? concertEvents : [];
                const upcomingEvents = [...safeConcertEvents].sort((a, b) => {
                  const ta = new Date(a.startsAt || 0).getTime();
                  const tb = new Date(b.startsAt || 0).getTime();
                  return ta - tb;
                });
                const dateTileOf = (iso?: string) => {
                  if (!iso) return null;
                  const d = new Date(iso);
                  if (isNaN(d.getTime())) return null;
                  return {
                    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
                    day: d.toLocaleDateString('en-US', { day: '2-digit' }),
                  };
                };
                const totalShows = upcomingEvents.length || shows.length;
                widgetElement = (
                  <div className={cardStyles} style={cardStyleInline}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg" style={{ background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})` }}>
                          <Calendar className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-white leading-tight tracking-tight">{t('profile.shows.title')}</h3>
                          <p className="text-[11px] text-gray-400">{totalShows > 0 ? `${totalShows} ${totalShows === 1 ? 'fecha' : 'fechas'} en agenda` : 'Próximas fechas'}</p>
                        </div>
                      </div>
                      {totalShows > 0 && (
                        <span className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-semibold" style={{ background: `${colors.hexAccent}22`, color: colors.hexAccent, border: `1px solid ${colors.hexAccent}40` }}>
                          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: colors.hexAccent }} />
                          {totalShows}
                        </span>
                      )}
                      {isOwnProfile && (
                        <button
                          type="button"
                          onClick={() => setShowsManagerOpen((v) => !v)}
                          className="ml-1 flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-xl font-semibold transition-all hover:opacity-90"
                          style={{ background: showsManagerOpen ? `${colors.hexAccent}22` : `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`, color: showsManagerOpen ? colors.hexAccent : 'white', border: showsManagerOpen ? `1px solid ${colors.hexAccent}40` : 'none' }}
                        >
                          {showsManagerOpen ? <><X className="h-3.5 w-3.5" /> Cerrar</> : <><Plus className="h-3.5 w-3.5" /> Gestionar</>}
                        </button>
                      )}
                    </div>
                    {/* Owner inline manager — add a date (sells real tickets via Concert Center) */}
                    {isOwnProfile && showsManagerOpen && (
                      <div className="mb-4 rounded-2xl border p-4 space-y-3" style={{ borderColor: `${colors.hexAccent}33`, background: `linear-gradient(180deg, ${colors.hexPrimary}10, rgba(12,12,16,0.6))` }}>
                        <button
                          type="button"
                          onClick={() => setTicketCenterOpen(true)}
                          className="w-full flex items-center justify-between gap-2 rounded-xl px-3.5 py-3 text-left transition-all hover:opacity-95"
                          style={{ background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})` }}
                        >
                          <span className="flex items-center gap-2.5">
                            <Ticket className="h-5 w-5 text-white" />
                            <span className="flex flex-col">
                              <span className="text-sm font-bold text-white leading-tight">Centro de Tickets completo</span>
                              <span className="text-[11px] text-white/80 leading-tight">Pagos Stripe · tiers · check-in QR · mensajería</span>
                            </span>
                          </span>
                          <ChevronRight className="h-5 w-5 text-white flex-shrink-0" />
                        </button>
                        <div className="flex items-center gap-2 pt-1">
                          <Calendar className="h-4 w-4" style={{ color: colors.hexAccent }} />
                          <span className="text-sm font-bold text-white">Nueva fecha</span>
                        </div>
                        <p className="text-[11px] text-gray-400 -mt-1">Se crea como evento real en el Concert Center (entradas con QR + pago seguro si pones precio).</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={newShowForm.venue}
                            onChange={(e) => setNewShowForm((f) => ({ ...f, venue: e.target.value }))}
                            placeholder="Lugar / nombre del show *"
                            className="w-full bg-black/40 border rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none"
                            style={{ borderColor: `${colors.hexAccent}33` }}
                          />
                          <input
                            type="datetime-local"
                            value={newShowForm.date}
                            onChange={(e) => setNewShowForm((f) => ({ ...f, date: e.target.value }))}
                            className="w-full bg-black/40 border rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none"
                            style={{ borderColor: `${colors.hexAccent}33` }}
                          />
                          <input
                            type="text"
                            value={newShowForm.location}
                            onChange={(e) => setNewShowForm((f) => ({ ...f, location: e.target.value }))}
                            placeholder="Ciudad / ubicación *"
                            className="w-full bg-black/40 border rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none"
                            style={{ borderColor: `${colors.hexAccent}33` }}
                          />
                          <input
                            type="number"
                            min={0}
                            value={newShowForm.price}
                            onChange={(e) => setNewShowForm((f) => ({ ...f, price: e.target.value }))}
                            placeholder="Precio entrada USD (0 = gratis)"
                            className="w-full bg-black/40 border rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none"
                            style={{ borderColor: `${colors.hexAccent}33` }}
                          />
                          <input
                            type="number"
                            min={0}
                            value={newShowForm.capacity}
                            onChange={(e) => setNewShowForm((f) => ({ ...f, capacity: e.target.value }))}
                            placeholder="Aforo (opcional)"
                            className="w-full bg-black/40 border rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none"
                            style={{ borderColor: `${colors.hexAccent}33` }}
                          />
                          <input
                            type="url"
                            value={newShowForm.ticketUrl}
                            onChange={(e) => setNewShowForm((f) => ({ ...f, ticketUrl: e.target.value }))}
                            placeholder="URL entradas externa (opcional)"
                            className="w-full bg-black/40 border rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none"
                            style={{ borderColor: `${colors.hexAccent}33` }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleAddUpcomingShow}
                          disabled={addingShow}
                          className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
                          style={{ background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`, color: 'white' }}
                        >
                          {addingShow ? <><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> Agregando…</> : <><Plus className="h-4 w-4" /> Agregar fecha</>}
                        </button>
                      </div>
                    )}
                    {upcomingEvents.length > 0 ? (
                      <div className="space-y-3">
                        {upcomingEvents.map((event) => {
                          const eventDate = new Date(event.startsAt || '');
                          const validDate = !isNaN(eventDate.getTime());
                          const tile = dateTileOf(event.startsAt);
                          const poster = (event as any).posterUrl as string | undefined;
                          const activeTiers = (event.tiers || []).filter((tier) => Number(tier.priceUsd) > 0 && tier.remaining !== 0);
                          const minPrice = activeTiers.length
                            ? Math.min(...activeTiers.map((tier) => Number(tier.priceUsd) || 0))
                            : 0;
                          return (
                            <div
                              key={`concert-${event.id}`}
                              className="group relative rounded-2xl border overflow-hidden transition-all duration-300 hover:-translate-y-0.5"
                              style={{ borderColor: `${colors.hexAccent}33`, background: `linear-gradient(180deg, ${colors.hexPrimary}14, rgba(12,12,16,0.5))`, boxShadow: `0 10px 30px -16px ${colors.hexAccent}99` }}
                            >
                              {poster && (
                                <div className="relative h-24 overflow-hidden">
                                  <img src={poster} alt={event.venue || event.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                                  <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent 30%, rgba(11,11,16,0.92))' }} />
                                </div>
                              )}
                              <div className="p-3">
                                <div className="flex items-start gap-3">
                                  {tile && (
                                    <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl flex-shrink-0 leading-none" style={{ background: `linear-gradient(160deg, ${colors.hexAccent}33, ${colors.hexPrimary}1a)`, border: `1px solid ${colors.hexAccent}44` }}>
                                      <span className="text-[9px] font-bold tracking-wider" style={{ color: colors.hexAccent }}>{tile.month}</span>
                                      <span className="text-lg font-extrabold text-white -mt-0.5">{tile.day}</span>
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <h4 className="font-bold text-white text-sm leading-tight truncate">{event.venue || event.title}</h4>
                                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
                                      <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                                      <span className="truncate">{validDate
                                        ? `${eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
                                        : 'Date TBA'}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                                      <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                                      <span className="truncate">{event.location || event.venue || 'TBA'}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between gap-2 mt-3">
                                  {activeTiers.length > 0 ? (
                                    <span className="text-xs font-semibold px-2 py-1 rounded-lg" style={{ background: `${colors.hexAccent}1a`, color: colors.hexAccent }}>
                                      {minPrice > 0 ? `Desde $${minPrice.toFixed(2)}` : 'Entradas disponibles'}
                                    </span>
                                  ) : <span />}
                                  <div className="flex items-center gap-2">
                                    {isOwnProfile && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteUpcomingShow(String(event.id))}
                                        disabled={deletingShowId === String(event.id)}
                                        title="Eliminar fecha"
                                        className="p-2 rounded-xl text-xs font-bold transition-all hover:bg-red-500/15 disabled:opacity-50"
                                        style={{ border: '1px solid rgba(248,113,113,0.35)', color: '#f87171' }}
                                      >
                                        {deletingShowId === String(event.id) ? <span className="animate-spin h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full inline-block" /> : <Trash2 className="h-3.5 w-3.5" />}
                                      </button>
                                    )}
                                    {activeTiers.length > 0 ? (
                                      <button
                                        type="button"
                                        onClick={() => setBuyConcertEvent(event)}
                                        className="px-3.5 py-2 rounded-xl text-xs font-bold hover:opacity-90 hover:shadow-lg transition-all flex items-center gap-1.5"
                                        style={{ background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`, color: 'white' }}
                                      >
                                        <Ticket className="h-3.5 w-3.5" />
                                        {t('profile.shows.tickets')}
                                      </button>
                                    ) : event.linkedModules?.externalTicketUrl ? (
                                      <a href={event.linkedModules.externalTicketUrl} target="_blank" rel="noopener noreferrer" className="px-3.5 py-2 rounded-xl text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5" style={{ background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`, color: 'white' }}>
                                        <Ticket className="h-3.5 w-3.5" />{t('profile.shows.tickets')}
                                      </a>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : shows.length > 0 ? (
                      <div className="space-y-3">
                        {shows.map((show) => {
                          const showDate = new Date(show.date);
                          const validDate = !isNaN(showDate.getTime());
                          const tile = dateTileOf(show.date);
                          const formattedDate = validDate ? showDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date TBA';
                          const formattedTime = validDate ? showDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '';
                          return (
                            <div
                              key={show.id}
                              className="group rounded-2xl border p-3 transition-all duration-300 hover:-translate-y-0.5"
                              style={{ borderColor: `${colors.hexAccent}33`, background: `linear-gradient(180deg, ${colors.hexPrimary}14, rgba(12,12,16,0.5))`, boxShadow: `0 10px 30px -16px ${colors.hexAccent}99` }}
                            >
                              <div className="flex items-start gap-3">
                                {tile && (
                                  <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl flex-shrink-0 leading-none" style={{ background: `linear-gradient(160deg, ${colors.hexAccent}33, ${colors.hexPrimary}1a)`, border: `1px solid ${colors.hexAccent}44` }}>
                                    <span className="text-[9px] font-bold tracking-wider" style={{ color: colors.hexAccent }}>{tile.month}</span>
                                    <span className="text-lg font-extrabold text-white -mt-0.5">{tile.day}</span>
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-2">
                                    <h4 className="font-bold text-white text-sm leading-tight truncate">{show.venue}</h4>
                                    {show.ticketUrl && (
                                      <a href={show.ticketUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-xl text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5 flex-shrink-0" style={{ background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`, color: 'white' }}>
                                        <Ticket className="h-3.5 w-3.5" />{t('profile.shows.tickets')}
                                      </a>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
                                    <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
                                    <span className="truncate">{formattedDate}{formattedTime ? ` · ${formattedTime}` : ''}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                                    <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                                    <span className="truncate">{show.location}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-10 px-4 rounded-2xl relative overflow-hidden" style={{ background: `radial-gradient(120% 120% at 50% 0%, ${colors.hexAccent}1f, rgba(10,10,14,0.5) 60%)`, border: `1px dashed ${colors.hexAccent}33` }}>
                        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center" style={{ background: `${colors.hexAccent}1a`, border: `1px solid ${colors.hexAccent}33` }}>
                          <Calendar className="h-7 w-7" style={{ color: colors.hexAccent }} />
                        </div>
                        <p className="text-sm text-white font-semibold">{t('profile.shows.noShows')}</p>
                        <p className="text-xs text-gray-400 mt-1">Vuelve pronto para ver las próximas fechas.</p>
                        {isOwnProfile && !showsManagerOpen && (
                          <button
                            type="button"
                            onClick={() => setShowsManagerOpen(true)}
                            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90"
                            style={{ background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`, color: 'white' }}
                          >
                            <Plus className="h-3.5 w-3.5" /> Agregar tu primera fecha
                          </button>
                        )}
                      </div>
                    )}
                    {/* Full Concert/Ticket Center modal launched from this widget (owner) */}
                    {isOwnProfile && ticketCenterOpen && createPortal(
                      <div className="fixed inset-0 z-[2000] flex items-start justify-center overflow-y-auto bg-black/80 backdrop-blur-sm p-3 sm:p-6" onClick={() => setTicketCenterOpen(false)}>
                        <div className="relative w-full max-w-2xl my-4" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setTicketCenterOpen(false)}
                            className="absolute -top-1 right-0 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
                            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
                          >
                            <X className="h-3.5 w-3.5" /> Cerrar
                          </button>
                          <div className="rounded-2xl p-4 sm:p-5 mt-8" style={{ background: 'rgba(12,12,16,0.96)', border: `1px solid ${colors.hexAccent}33` }}>
                            <ConcertCommandCenter
                              artistId={userProfile?.pgId || (typeof artistId === 'number' ? artistId : parseInt(String(artistId), 10))}
                              artistName={userProfile?.artistName || userProfile?.username || artist?.name || 'Artist'}
                              artistSlug={userProfile?.slug || undefined}
                              isOwner={isOwnProfile}
                              colors={{ hexPrimary: colors.hexPrimary, hexAccent: colors.hexAccent, hexBorder: colors.hexBorder }}
                            />
                          </div>
                        </div>
                      </div>,
                      document.body,
                    )}
                  </div>
                );
              }

              if (widgetId === 'concert-hub') {
                widgetElement = (
                  <div className={cardStyles} style={cardStyleInline}>
                    <ConcertCommandCenter
                      artistId={userProfile?.pgId || (typeof artistId === 'number' ? artistId : parseInt(String(artistId), 10))}
                      artistName={userProfile?.artistName || userProfile?.username || artist?.name || 'Artist'}
                      artistSlug={userProfile?.slug || undefined}
                      isOwner={isOwnProfile}
                      colors={{ hexPrimary: colors.hexPrimary, hexAccent: colors.hexAccent, hexBorder: colors.hexBorder }}
                    />
                  </div>
                );
              }

              if (!widgetElement) return null;

              // Wrap collapsible widgets with expand/collapse
              const collapsibleIds = ['qr-card', 'physical-cards', 'statistics', 'premium-tools', 'information', 'social-media', 'spotify', 'upcoming-shows', 'economic-engine', 'crypto-community', 'tokenized-music', 'concert-hub'];
              if (collapsibleIds.includes(widgetId)) {
                widgetElement = (
                  <div>
                    <button
                      onClick={() => setRightExpanded(prev => ({ ...prev, [widgetId]: !prev[widgetId] }))}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors hover:bg-gray-800/30 ${isExpanded ? 'mb-2' : ''}`}
                      style={{ borderColor: colors.hexBorder }}
                    >
                      <span className="text-sm font-semibold" style={{ color: colors.hexAccent }}>{widgetName}</span>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                    </button>
                    {isExpanded && widgetElement}
                  </div>
                );
              }

              // Wrap premium right-column widgets with PremiumGate for free-tier users
              if (isOwnProfile && tierLimits.isModuleLocked(widgetId)) {
                widgetElement = (
                  <PremiumGate
                    locked={true}
                    featureName={rightWidgets[widgetId]?.name || widgetId}
                    accentColor={colors.hexAccent}
                  >
                    {widgetElement}
                  </PremiumGate>
                );
              }

              // Add usage guide below each widget for logged-in profile owners
              if (isOwnProfile) {
                widgetElement = (
                  <>
                    {widgetElement}
                    <ModuleGuide moduleId={widgetId} accentColor={colors.hexAccent} />
                  </>
                );
              }

              // Wrap with widget ID for scroll targeting + return-to-CC button
              widgetElement = (
                <div id={`widget-${widgetId}`} className="relative">
                  {sectionVisibility['social-hub'] && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        const cc = document.getElementById('section-social-hub');
                        if (cc) cc.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                      }}
                      onTouchEnd={(e) => {
                        e.preventDefault();
                        const cc = document.getElementById('section-social-hub');
                        if (cc) cc.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                      }}
                      className={`absolute -top-1 right-2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-semibold uppercase tracking-wider backdrop-blur-xl border transition-all duration-300 hover:scale-105 active:scale-95 hover:opacity-100 ${chromeVisible ? 'opacity-70' : 'opacity-0 pointer-events-none'}`}
                      style={{
                        background: 'rgba(0,0,0,0.6)',
                        borderColor: `${colors.hexAccent}30`,
                        color: colors.hexAccent,
                        touchAction: 'manipulation',
                        WebkitTapHighlightColor: 'transparent',
                        minWidth: 44,
                        minHeight: 36,
                        pointerEvents: chromeVisible ? 'auto' : 'none',
                      }}
                      title="Back to Command Center"
                    >
                      <Layout className="w-3 h-3" />
                      <span>CC</span>
                    </button>
                  )}
                  {widgetElement}
                </div>
              );

              return (isOwnProfile && !isStatic) ? (
                <Draggable key={widgetId} draggableId={`right-${widgetId}`} index={widgetIndex} isDragDisabled={tierLimits.isFree}>
                  {(dragProvided, dragSnapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      className={`group/drag relative ${dragSnapshot.isDragging ? 'z-50 shadow-2xl' : ''}`}
                    >
                      {!tierLimits.isFree && (
                      <div
                        {...dragProvided.dragHandleProps}
                        className="flex items-center justify-center gap-2 py-1.5 -mb-2 rounded-t-2xl opacity-0 group-hover/drag:opacity-100 transition-all duration-200 cursor-grab active:cursor-grabbing select-none"
                        style={{ background: `linear-gradient(135deg, ${colors.hexPrimary}40, ${colors.hexAccent}30)` }}
                      >
                        <GripVertical className="h-4 w-4" style={{ color: colors.hexAccent }} />
                        <span className="text-[10px] font-medium tracking-wider uppercase" style={{ color: colors.hexAccent }}>Drag to reorder</span>
                        <GripVertical className="h-4 w-4" style={{ color: colors.hexAccent }} />
                      </div>
                      )}
                      {widgetElement}
                    </div>
                  )}
                </Draggable>
              ) : (
                <div key={widgetId}>{widgetElement}</div>
              );
              };
              widgetRendererRef.current = renderWidgetCard;
              const rightWidgetIds = rightOrder.filter(wId => {
                if (sideOf(wId) === 'left') return false;
                if (rightVisibility[wId] === false) return false;
                if (wId === 'physical-cards' || wId === 'statistics' || wId === 'premium-tools') return isOwnProfile;
                if (wId === 'social-media') return !!(artist.instagram || artist.twitter || artist.youtube);
                if (wId === 'spotify') return !!(artist.spotify && getSpotifyEmbedUrl(artist.spotify));
                return true;
              });
              return rightWidgetIds.map((id, i) => renderWidgetCard(id, i));
            })()}
            {rightDropProvided.placeholder}
            </div>
          )}
        </Droppable>

          {/* Slot for sections relocated to the RIGHT column (portaled at bottom) */}
          <div ref={rightRelocSlotRef} className="flex flex-col gap-4 empty:hidden" />

          </section>
        </main>

        {/* Cross-column relocations: render modules whose side was overridden into
            the opposite column's slot (appended at the bottom, filling PC gaps).
            relocTick guarantees a render after the slot refs are attached. */}
        {relocTick >= 0 && leftRelocSlotRef.current && widgetRendererRef.current && createPortal(
          rightOrder
            .filter(id => sideOf(id) === 'left' && rightVisibility[id] !== false)
            .map((id, i) => widgetRendererRef.current!(id, i, true)),
          leftRelocSlotRef.current
        )}
        {relocTick >= 0 && rightRelocSlotRef.current && sectionRendererRef.current && createPortal(
          sectionOrder
            .filter(id => sectionVisibility[id] && sideOf(id) === 'right')
            .map((id, i) => sectionRendererRef.current!(id, i, true)),
          rightRelocSlotRef.current
        )}

        {/* -- VIDEO SERVICE PROMO � Fixed promotional block (always visible) -- */}
        <div className="mt-4 rounded-3xl overflow-hidden relative" style={{ ...cardStyleInline, padding: 0, border: `1px solid ${colors.hexPrimary}40` }}>
          {/* Scanning light animation */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div style={{
              position: 'absolute', inset: 0,
              background: `linear-gradient(135deg, ${colors.hexPrimary}24 0%, rgba(24,24,27,0.95) 50%, ${colors.hexAccent}1F 100%)`,
            }} />
            <motion.div
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'linear', repeatDelay: 3 }}
              style={{
                position: 'absolute', top: 0, left: 0,
                width: '40%', height: '100%',
                background: `linear-gradient(90deg, transparent, ${colors.hexPrimary}12, transparent)`,
              }}
            />
            {[...Array(8)].map((_, i) => (
              <div key={i} style={{
                position: 'absolute',
                width: i % 3 === 0 ? 3 : 2, height: i % 3 === 0 ? 3 : 2,
                borderRadius: '50%',
                background: i < 4 ? colors.hexPrimary : colors.hexAccent,
                opacity: 0.25,
                left: `${6 + i * 12}%`,
                top: `${12 + (i % 4) * 20}%`,
                animation: `float ${2.5 + i * 0.4}s ease-in-out infinite alternate`,
                animationDelay: `${i * 0.3}s`,
              }} />
            ))}
          </div>

          <div className="relative z-10 px-5 py-6">
            {/* Top row: icon + label */}
            <div className="flex items-center gap-3 mb-4">
              <motion.div
                animate={{ scale: [1, 1.08, 1], rotate: [0, -6, 6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${colors.hexPrimary}4D, ${colors.hexAccent}33)`,
                  boxShadow: `0 0 24px ${colors.hexPrimary}47`,
                  border: `1px solid ${colors.hexPrimary}4D`,
                }}
              >
                <Film className="h-6 w-6" style={{ color: colors.hexPrimary }} />
              </motion.div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-black text-white">Video Service</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${colors.hexPrimary}33`, color: colors.hexPrimary }}>
                    PROMO
                  </span>
                </div>
                <p className="text-[11px] text-gray-500">by Boostify</p>
              </div>
            </div>

            {/* Headline */}
            <h3 className="text-base font-black mb-1.5" style={{ background: `linear-gradient(90deg, ${colors.hexPrimary}, ${colors.hexAccent})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Bring Your Music to Life on Screen
            </h3>
            <p className="text-[11px] text-gray-400 mb-4 leading-relaxed">
              Professional music videos, AI visuals, lyric videos & more. We handle everything — you focus on the music.
            </p>

            {/* Service tiles */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { icon: Sparkles, label: 'AI Music Video', desc: 'AI visuals synced to your track', color: colors.hexPrimary },
                { icon: Camera, label: 'Premium Production', desc: 'Full crew & post-production', color: colors.hexAccent },
                { icon: Film, label: 'Lyric Videos', desc: 'Cinematic text animations', color: colors.hexPrimary },
                { icon: Rocket, label: 'Reels & Shorts', desc: 'Social-ready short clips', color: colors.hexAccent },
              ].map(({ icon: Icon, label, desc, color }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.08 }}
                  className="rounded-xl p-2.5 flex flex-col gap-1"
                  style={{ background: `${color}10`, border: `1px solid ${color}20` }}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
                    <Icon className="h-3.5 w-3.5" style={{ color }} />
                  </div>
                  <div className="text-[11px] font-bold text-white">{label}</div>
                  <div className="text-[10px] text-gray-500 leading-tight">{desc}</div>
                </motion.div>
              ))}
            </div>

            {/* CTA */}
            <Link href="/videoservice">
              <motion.button
                whileHover={{ scale: 1.03, boxShadow: `0 6px 28px ${colors.hexPrimary}66` }}
                whileTap={{ scale: 0.97 }}
                className="w-full py-3 rounded-xl text-sm font-black flex items-center justify-center gap-2"
                style={{
                  background: `linear-gradient(135deg, ${colors.hexPrimary} 0%, ${colors.hexAccent} 100%)`,
                  color: 'white',
                  boxShadow: `0 4px 20px ${colors.hexPrimary}47`,
                }}
              >
                <Film className="h-4 w-4" />
                Get My Music Video
                <ArrowRight className="h-4 w-4" />
              </motion.button>
            </Link>
          </div>
        </div>

        {/* CTA for non-authenticated visitors - Bottom of page */}
        {!isOwnProfile && !user && (
          <div className="mt-8">
            <div className="rounded-3xl overflow-hidden relative" style={{ ...cardStyleInline, padding: 0, border: `1px solid ${colors.hexPrimary}40` }}>
              {/* Animated background */}
              <div className="absolute inset-0 pointer-events-none">
                <div style={{
                  position: 'absolute', inset: 0,
                  background: `linear-gradient(135deg, ${colors.hexPrimary}26 0%, ${colors.hexAccent}1F 50%, ${colors.hexPrimary}14 100%)`,
                }} />
                <motion.div
                  animate={{ x: ['0%', '100%', '0%'], opacity: [0.15, 0.35, 0.15] }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    position: 'absolute', top: 0, left: '-50%',
                    width: '200%', height: '2px',
                    background: `linear-gradient(90deg, transparent, ${colors.hexPrimary}, ${colors.hexAccent}, transparent)`,
                  }}
                />
                {[...Array(8)].map((_, i) => (
                  <div key={i} style={{
                    position: 'absolute',
                    width: i % 3 === 0 ? 3 : 2, height: i % 3 === 0 ? 3 : 2,
                    borderRadius: '50%',
                    background: i < 4 ? colors.hexPrimary : colors.hexAccent,
                    opacity: 0.3,
                    left: `${8 + i * 12}%`,
                    top: `${10 + (i % 4) * 22}%`,
                    animation: `float ${2.5 + i * 0.4}s ease-in-out infinite alternate`,
                    animationDelay: `${i * 0.3}s`,
                  }} />
                ))}
              </div>

              <div className="relative z-10 px-6 py-10 text-center">
                {/* Animated icon */}
                <motion.div
                  animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-20 h-20 rounded-3xl mx-auto mb-5 flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${colors.hexPrimary}4D, ${colors.hexAccent}40)`,
                    boxShadow: `0 0 40px ${colors.hexPrimary}40`,
                    border: `1px solid ${colors.hexPrimary}59`,
                  }}
                >
                  <Rocket className="h-10 w-10" style={{ color: colors.hexPrimary }} />
                </motion.div>

                {/* Badge */}
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold mb-4"
                  style={{ background: `${colors.hexPrimary}26`, color: colors.hexPrimary, border: `1px solid ${colors.hexPrimary}4D` }}
                >
                  <Sparkles className="h-3 w-3" />
                  Free to Start · No Credit Card
                </motion.div>

                {/* Headline */}
                <motion.h3
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-2xl md:text-3xl font-black mb-3"
                  style={{
                    background: `linear-gradient(90deg, #ffffff, ${colors.hexPrimary}, ${colors.hexAccent})`,
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  }}
                >
                  Launch Your Music Career on Boostify
                </motion.h3>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-gray-400 text-sm max-w-lg mx-auto mb-6 leading-relaxed"
                >
                  Join thousands of independent artists managing their music, growing their fanbase, and earning — all from one powerful platform.
                </motion.p>

                {/* Feature row */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="flex flex-wrap justify-center gap-2 mb-7"
                >
                  {([
                    ['Distribute Music', Music],
                    ['Music Videos', Film],
                    ['Sell Merch', ShoppingBag],
                    ['Fan Community', Users],
                    ['Analytics', BarChart3],
                  ] as [string, typeof Music][]).map(([feat, FeatIcon]) => (
                    <span key={feat} className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.06)', color: '#d1d5db', border: '1px solid rgba(255,255,255,0.10)' }}>
                      <FeatIcon className="h-3 w-3" style={{ color: colors.hexPrimary }} />
                      {feat}
                    </span>
                  ))}
                </motion.div>

                {/* CTA Button */}
                <Link href="/auth?returnTo=/profile">
                  <motion.button
                    whileHover={{ scale: 1.04, boxShadow: `0 8px 32px ${colors.hexPrimary}73` }}
                    whileTap={{ scale: 0.97 }}
                    className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-base font-black text-white shadow-xl"
                    style={{
                      background: `linear-gradient(135deg, ${colors.hexPrimary}, ${colors.hexAccent})`,
                      boxShadow: `0 4px 24px ${colors.hexPrimary}59`,
                    }}
                    data-testid="button-cta-bottom"
                  >
                    <Sparkles className="h-5 w-5" />
                    Create My Free Profile
                    <ArrowRight className="h-5 w-5" />
                  </motion.button>
                </Link>
                <p className="text-gray-600 text-xs mt-4">
                  Setup in 2 minutes · No credit card required
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Free-tier upgrade banner � shown to profile owner */}
        {isOwnProfile && tierLimits.isFree && (
          <div className="mt-8">
            <div
              className="rounded-3xl p-6 text-center border"
              style={{
                background: `linear-gradient(135deg, ${colors.hexPrimary}20, ${colors.hexAccent}15)`,
                borderColor: colors.hexAccent + '40',
              }}
            >
              <Crown className="h-10 w-10 mx-auto mb-3" style={{ color: colors.hexAccent }} />
              <h3 className="text-xl font-bold text-white mb-2">Unlock Your Full Potential</h3>
              <p className="text-gray-400 text-sm mb-4 max-w-md mx-auto">
                Upgrade to unlock unlimited uploads, premium modules, drag-and-drop layout, all 20 themes, and remove the Boostify watermark.
              </p>
              <a
                href="/pricing"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-black text-sm hover:scale-105 transition-all shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${colors.hexAccent}, ${colors.hexPrimary})`,
                  boxShadow: `0 4px 20px ${colors.hexAccent}40`,
                }}
              >
                <Sparkles className="h-4 w-4" />
                View Plans & Upgrade
              </a>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t" style={{ borderColor: colors.hexBorder }}>
          <div className="text-center">
            <p className="text-sm text-gray-400">
              {t('profile.footer.poweredBy')} <span style={{ color: colors.hexAccent }} className="font-semibold">Boostify Music</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              � {new Date().getFullYear()} All rights reserved.
            </p>
          </div>
        </footer>

      </div>

      {/* Download Password Dialog */}
      <Dialog open={showDownloadDialog} onOpenChange={setShowDownloadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descargar Video</DialogTitle>
            <DialogDescription>
              Este video est� protegido. Ingresa el password para descargarlo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="download-password">Password</Label>
              <Input
                id="download-password"
                type="password"
                value={downloadPasswordInput}
                onChange={(e) => setDownloadPasswordInput(e.target.value)}
                placeholder="Ingresa el password"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleConfirmDownload();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDownloadDialog(false);
                setDownloadPasswordInput('');
                setDownloadVideoId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDownload}
              style={{ backgroundColor: colors.hexPrimary, color: 'white' }}
            >
              Descargar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video Player Modal - con notas a tiempo codificado */}
      {playingVideo && (
        <VideoPlayerWithNotes
          videoId={String(playingVideo.id)}
          videoUrl={playingVideo.url || ''}
          title={playingVideo.title}
          posterUrl={playingVideo.thumbnailUrl || null}
          ownerUserId={userProfile?.pgId ? Number(userProfile.pgId) : null}
          accentColor={colors.hexPrimary}
          onClose={() => setPlayingVideo(null)}
          onEnded={() => {
            // Auto-advance to the next video in the list (queue behavior).
            const idx = videos.findIndex((v) => v.id === playingVideo.id);
            const next = idx >= 0 && idx + 1 < videos.length ? videos[idx + 1] : null;
            if (next) {
              setPlayingVideo(next);
            } else {
              setPlayingVideo(null);
            }
          }}
          extraActions={playingVideo?.scriptPdfUrl ? (
            <button
              className="py-2 px-4 rounded-full text-xs font-bold transition-all duration-300 transform hover:scale-105 shadow-lg flex items-center gap-1.5"
              style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white' }}
              onClick={() => { setPlayingVideo(null); setViewingPdf(playingVideo); }}
            >
              <FileText className="h-3.5 w-3.5" />
              Ver Video Script
            </button>
          ) : null}
        />
      )}

      {/* PDF Script Viewer Modal */}
      <Dialog open={!!viewingPdf} onOpenChange={(open) => !open && setViewingPdf(null)}>
        <DialogContent className="max-w-4xl w-full h-[85vh] bg-gray-950 border border-gray-800 p-0 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <div>
              <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-orange-400" />
                Video Script
              </h3>
              <p className="text-gray-400 text-sm mt-0.5">{viewingPdf?.title}</p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={viewingPdf?.scriptPdfUrl || '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="py-2 px-4 rounded-full text-xs font-bold transition-all duration-300 hover:scale-105 shadow-lg"
                style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white' }}
              >
                <Download className="h-3.5 w-3.5 inline mr-1.5" />
                Descargar PDF
              </a>
              <button
                onClick={() => setViewingPdf(null)}
                className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-all"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4 text-white" />
              </button>
            </div>
          </div>
          <div className="flex-1 w-full">
            {viewingPdf?.scriptPdfUrl && (
              <iframe
                src={viewingPdf.scriptPdfUrl}
                className="w-full h-full border-0"
                title={`Script - ${viewingPdf.title}`}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Fan Monetization: pay-what-you-want catalog unlock modal ──────── */}
      <Dialog open={unlockModalOpen} onOpenChange={setUnlockModalOpen}>
        <DialogContent className="max-w-md w-full bg-gray-950 border border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Lock className="h-5 w-5 text-orange-400" />
              Unlock the full catalog
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              You listened to your free {previewSeconds}s preview. Support{" "}
              <span className="text-white font-semibold">
                {(artist as any)?.artistName || artist?.name || "this artist"}
              </span>{" "}
              and choose your access: lifetime unlock or monthly membership.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Plan selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setUnlockPlan("lifetime")}
                className={`rounded-xl border p-3 text-left transition-all ${
                  unlockPlan === "lifetime"
                    ? "border-orange-400 bg-orange-500/15"
                    : "border-gray-700 bg-gray-900/40 hover:border-orange-500/60"
                }`}
              >
                <p className="text-xs uppercase tracking-wide text-orange-300">One-time</p>
                <p className="text-sm font-bold text-white">Lifetime unlock</p>
                <p className="text-[11px] text-gray-400">From $5 · keep access forever</p>
              </button>
              <button
                type="button"
                onClick={() => setUnlockPlan("monthly")}
                className={`rounded-xl border p-3 text-left transition-all ${
                  unlockPlan === "monthly"
                    ? "border-pink-400 bg-pink-500/15"
                    : "border-gray-700 bg-gray-900/40 hover:border-pink-500/60"
                }`}
              >
                <p className="text-xs uppercase tracking-wide text-pink-300">Monthly</p>
                <p className="text-sm font-bold text-white">$20 / month</p>
                <p className="text-[11px] text-gray-400">Full catalog + monthly drops*</p>
              </button>
            </div>

            {!isAuthenticated && (
              <div className="space-y-2 rounded-xl border border-gray-700 bg-gray-900/60 p-3">
                <p className="text-xs text-gray-300">
                  This creates your fan account under this artist only (not a platform-wide account).
                </p>
                <input
                  type="text"
                  value={guestFanName}
                  onChange={(e) => setGuestFanName(e.target.value)}
                  placeholder="Your name (optional)"
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-700 text-white focus:border-orange-500 focus:outline-none"
                />
                <input
                  type="email"
                  value={guestFanEmail}
                  onChange={(e) => setGuestFanEmail(e.target.value)}
                  placeholder="Your email (required)"
                  className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-700 text-white focus:border-orange-500 focus:outline-none"
                />
              </div>
            )}

            {unlockPlan === "lifetime" ? (
              <>
                {/* Preset amounts */}
                <div className="grid grid-cols-3 gap-2">
                  {[5, 10, 20].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setUnlockAmount(amt)}
                      className={`py-3 rounded-xl font-bold text-lg transition-all border ${
                        Number(unlockAmount) === amt
                          ? "bg-gradient-to-br from-orange-500 to-orange-600 border-orange-400 text-white scale-105"
                          : "bg-gray-900 border-gray-700 text-gray-200 hover:border-orange-500"
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>

                {/* Custom amount */}
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">
                    Or choose your contribution (minimum $5)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                    <input
                      type="number"
                      min={5}
                      step={1}
                      value={unlockAmount}
                      onChange={(e) => setUnlockAmount(Number(e.target.value))}
                      className="w-full pl-7 pr-3 py-2.5 rounded-xl bg-gray-900 border border-gray-700 text-white focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-pink-500/30 bg-pink-500/5 p-3 text-xs text-gray-200 space-y-1.5">
                <p className="font-semibold text-pink-300">Monthly membership includes:</p>
                <p>• Full access to all songs while your membership is active.</p>
                <p>
                  • {accessData?.benefits?.monthlyAlbumMessage || "1 album/month for AI artists, or album drops when available for human artists."}
                </p>
                <p>• Additional fan benefits when they are available.</p>
                {!isAuthenticated && (
                  <p className="text-amber-300">Login is required for monthly membership so we can sync your recurring access.</p>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={unlockPlan === "monthly" ? handleMonthlySubscriptionCheckout : handleUnlockCheckout}
              disabled={unlockLoading || (unlockPlan === "lifetime" && Number(unlockAmount) < 5)}
              className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-orange-500 to-pink-600 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {unlockLoading ? (
                "Redirecting to secure checkout..."
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {unlockPlan === "monthly" ? "Start monthly membership · $20/mo" : `Unlock for $${Number(unlockAmount) || 5}`}
                </>
              )}
            </button>
            <p className="text-[11px] text-center text-gray-500">
              {unlockPlan === "monthly"
                ? "Secure Stripe checkout · $20/month · full catalog while active · monthly album for AI artists or when available for human artists"
                : "Secure Stripe checkout · Lifetime access forever after payment · 85% goes directly to the artist"}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* News Article Modal */}
      <NewsArticleModal
        article={selectedArticle}
        isOpen={isNewsModalOpen}
        onClose={() => {
          setIsNewsModalOpen(false);
          setSelectedArticle(null);
        }}
        isOwner={!!isOwnProfile}
        onEdit={handleEditNews}
        onDelete={handleDeleteNews}
        onRegenerate={handleRegenerateNews}
      />

      {/* Song Metadata Modal for Distribution */}
      {selectedSongForMetadata && (
        <SongMetadataModal
          key={selectedSongForMetadata.id}
          song={selectedSongForMetadata}
          artistName={artist?.name || (artist as any)?.artistName || userProfile?.displayName || 'Artist'}
          artistImages={[
            artist?.profileImage || userProfile?.profileImage || userProfile?.photoURL,
            artist?.bannerImage || userProfile?.bannerImage,
          ].filter(Boolean) as string[]}
          colors={colors}
          isOpen={true}
          onClose={() => setSelectedSongForMetadata(null)}
          onSongUpdate={() => refetchSongs()}
        />
      )}

      {/* Song promotion modal (generate cover, captions, video concepts, hashtags) */}
      {promoteSongTarget && promotePgId !== null && (
        <PromoteSongModal
          songId={promotePgId}
          open={!!promoteSongTarget && promotePgId !== null}
          onOpenChange={(o: boolean) => { if (!o) { setPromoteSongTarget(null); setPromotePgId(null); } }}
        />
      )}

      {/* Karaoke Player � opens from song rows (Mic2 button) */}
      {karaokeSong && (
        <KaraokePlayer
          key={karaokeSong.id}
          song={{ id: karaokeSong.id, title: karaokeSong.title ?? karaokeSong.name, audioUrl: karaokeSong.audioUrl, coverArt: karaokeSong.coverArt, duration: karaokeSong.duration, genre: karaokeSong.genre }}
          artistName={(artist as any)?.artistName || artist?.name || userProfile?.displayName || 'Artist'}
          artistProfileImage={artist?.profileImage || userProfile?.profileImage || userProfile?.photoURL}
          onClose={() => setKaraokeSong(null)}
        />
      )}

      {/* Song cover-art dialog (AI generate / upload) */}
      {coverDialogSong && (
        <SongCoverGenerateDialog
          open={!!coverDialogSong}
          onOpenChange={(o: boolean) => { if (!o) setCoverDialogSong(null); }}
          songId={coverDialogSong.id}
          songTitle={coverDialogSong.title || coverDialogSong.name}
          songGenre={(coverDialogSong as any).genre}
          artistName={(artist as any)?.artistName || artist?.name || userProfile?.displayName || 'Artist'}
          artistProfileImage={artist?.profileImage || userProfile?.profileImage || userProfile?.photoURL || null}
          initialCoverArt={coverDialogSong.coverArt || null}
          accentColor={colors.hexAccent}
          onSaved={(newCoverUrl: string) => {
            // Optimistically update the songs query cache so the new cover
            // shows immediately without waiting for a Firestore cache refresh.
            const songsKey = ["songs", userProfile?.firestoreId || artistId];
            queryClient.setQueryData(songsKey, (old: Song[] = []) =>
              old.map((s) => s.id === coverDialogSong?.id ? { ...s, coverArt: newCoverUrl } : s)
            );
            setCoverDialogSong(null);
            refetchSongs();
          }}
        />
      )}

      {/* Custom block editor modal (text / separator / banner / section) */}
      {editingBlockId && customBlocks[editingBlockId] && (
        <CustomBlockEditor
          block={customBlocks[editingBlockId]}
          accent={colors.hexAccent}
          onCancel={() => setEditingBlockId(null)}
          onSave={(b) => { updateCustomBlock(b); setEditingBlockId(null); }}
        />
      )}

      {/* --------- Owner quick-edit pill (top-right) ---------
          Visible only when viewing your own profile.
          Sign-in / logout is now shown inline below the Verified badge. */}
      {isOwnProfile && (
        <div
          className={`fixed z-40 flex items-center gap-1 rounded-full backdrop-blur-xl border shadow-lg transition-all duration-300 ${
            chromeVisible ? 'opacity-80 hover:opacity-100' : 'opacity-25 hover:opacity-100'
          }`}
          style={{
            right: 'max(0.75rem, env(safe-area-inset-right, 0px) + 0.5rem)',
            top: 'max(0.75rem, env(safe-area-inset-top, 0px) + 0.5rem)',
            background: 'rgba(0,0,0,0.55)',
            borderColor: `${colors.hexAccent}40`,
            padding: '4px',
          }}
          aria-label="Quick edit profile"
        >
          {/* Node Flow button */}
          <button
            type="button"
            onClick={() => setLocation(`/artist/${(userProfile as any)?.slug || artistId}/flow`)}
            className="h-9 w-9 flex items-center justify-center rounded-full transition-all duration-200 hover:scale-110 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: 'white',
            }}
            title="Artist Node Flow � visual control panel"
          >
            <Workflow className="h-4 w-4" />
          </button>
          {/* Edit profile button */}
          <button
            type="button"
            onClick={() => setQuickEditOpen(true)}
            className="h-9 w-9 flex items-center justify-center rounded-full transition-all duration-200 hover:scale-110 active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${colors.hexAccent}, ${colors.hexPrimary})`,
              color: 'white',
            }}
            title="Quick edit profile"
            data-testid="button-quick-edit-profile"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Hidden controlled EditProfileDialog driven by the floating quick-edit
          button. Owner-only. The full-page Dialog inside the bio area still
          works exactly as before � this is a parallel, headless instance. */}
      {isOwnProfile && (
        <EditProfileDialog
          hideTrigger
          open={quickEditOpen}
          onOpenChange={setQuickEditOpen}
          artistId={String(userProfile?.pgId || artistId)}
          currentData={{
            displayName: userProfile?.displayName || userProfile?.name || "",
            biography: userProfile?.biography || "",
            genre: userProfile?.genre || "",
            location: userProfile?.location || "",
            profileImage: userProfile?.photoURL || userProfile?.profileImage || "",
            bannerImage: userProfile?.bannerImage || "",
            bannerPosition: String((userProfile as any)?.bannerPosition ?? "50"),
            loopVideoUrl: (userProfile as any)?.loopVideoUrl || "",
            slug: (userProfile as any)?.slug || "",
            contactEmail: userProfile?.email || userProfile?.contactEmail || "",
            contactPhone: userProfile?.phone || userProfile?.contactPhone || "",
            instagram: userProfile?.instagram || "",
            twitter: userProfile?.twitter || "",
            youtube: userProfile?.youtube || "",
            spotify: userProfile?.spotify || "",
            pageMode: (artist.pageMode as any) || 'artist',
          }}
          onUpdate={() => {
            setGalleriesRefreshKey(prev => prev + 1);
            refetchProfile();
          }}
          onProductsChanged={() => { refetchProducts(); }}
          onGalleryCreated={() => { setGalleriesRefreshKey(prev => prev + 1); }}
        />
      )}
    </div>
    </DragDropContext>
    {!isOwnProfile && !!artistId && (
      <FanCaptureModal
        artistId={Number(userProfile?.pgId || artistId)}
        artistName={(artist as any)?.artistName || (artist as any)?.name || 'this artist'}
        artistSlug={(userProfile?.slug || (artist as any)?.slug || String(artistId)) as string}
        artistImage={userProfile?.photoURL || userProfile?.profileImage || (artist as any)?.profileImage || undefined}
        artistBannerImage={userProfile?.bannerImage || (artist as any)?.bannerImage || undefined}
        primaryColor={colors.hexPrimary}
        accentColor={colors.hexAccent}
      />
    )}
    {buyConcertEvent && (
      <TicketCheckoutModal
        event={buyConcertEvent}
        artistId={Number(userProfile?.pgId || artistId)}
        artistSlug={(userProfile?.slug || (artist as any)?.slug || String(artistId)) as string}
        artistName={((artist as any)?.artistName || artist?.name) as string}
        primary={colors.hexPrimary}
        accent={colors.hexAccent}
        border={colors.hexBorder}
        onClose={() => setBuyConcertEvent(null)}
      />
    )}
    </>
  );
}
